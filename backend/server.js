const express = require('express');
const cors = require('cors');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

const MAX_CONCURRENT_REQUESTS = parseInt(process.env.MAX_CONCURRENT) || 100;
const MAX_REQUESTS_PER_MINUTE = parseInt(process.env.MAX_REQUESTS_PER_MINUTE) || 60;

let activeRequests = 0;
const requestCounts = new Map();
const requestQueue = [];

setInterval(() => {
    requestCounts.clear();
}, 60000);

const rateLimiter = (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    if (!requestCounts.has(clientIP)) {
        requestCounts.set(clientIP, 0);
    }
    
    const clientRequests = requestCounts.get(clientIP);
    
    if (clientRequests >= MAX_REQUESTS_PER_MINUTE) {
        return res.status(429).json({
            error: '请求过于频繁，请稍后再试',
            retryAfter: 60
        });
    }
    
    requestCounts.set(clientIP, clientRequests + 1);
    
    if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
        return res.status(503).json({
            error: '当前访问人数较多，请稍后再试',
            currentLoad: activeRequests,
            maxLoad: MAX_CONCURRENT_REQUESTS,
            retryAfter: 10
        });
    }
    
    activeRequests++;
    
    res.on('finish', () => {
        activeRequests--;
    });
    
    res.on('close', () => {
        activeRequests--;
    });
    
    next();
};

const corsOptions = {
    origin: NODE_ENV === 'production' ? process.env.CORS_ORIGIN || '*' : '*',
    credentials: true
};

app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        rateLimiter(req, res, next);
    } else {
        next();
    }
});

let sequelize;

if (NODE_ENV === 'production' && process.env.DATABASE_URL) {
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        protocol: 'postgres',
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        },
        logging: false
    });
} else {
    const dbPath = path.join(__dirname, 'grade_management.db');
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: dbPath,
        logging: false
    });
}

const User = sequelize.define('User', {
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.STRING,
        defaultValue: 'user'
    }
});

const Exam = sequelize.define('Exam', {
    examName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    uploader: {
        type: DataTypes.STRING,
        allowNull: false
    }
});

const Grade = sequelize.define('Grade', {
    examId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    studentName: {
        type: DataTypes.STRING
    },
    studentId: {
        type: DataTypes.STRING
    },
    data: {
        type: DataTypes.JSON,
        allowNull: false
    }
});

const UploadLog = sequelize.define('UploadLog', {
    username: {
        type: DataTypes.STRING,
        allowNull: false
    },
    filename: {
        type: DataTypes.STRING
    },
    action: {
        type: DataTypes.STRING
    },
    details: {
        type: DataTypes.JSON
    }
});

User.hasMany(Exam, { foreignKey: 'uploader', sourceKey: 'username' });
Exam.belongsTo(User, { foreignKey: 'uploader', targetKey: 'username' });
Exam.hasMany(Grade, { foreignKey: 'examId' });
Grade.belongsTo(Exam, { foreignKey: 'examId' });

const jwt = require('jsonwebtoken');
const SECRET_KEY = 'grade_management_secret_key_2024';

function generateToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        SECRET_KEY,
        { expiresIn: '24h' }
    );
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: '未授权访问' });
    }
    
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '令牌无效' });
        }
        req.user = user;
        next();
    });
}

app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: '请提供用户名和密码' });
        }
        
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ error: '用户名已存在' });
        }
        
        const user = await User.create({
            username,
            password,
            role: username === 'admin' ? 'admin' : 'user'
        });
        
        res.json({
            message: '注册成功',
            user: { id: user.id, username: user.username, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: '请输入用户名和密码' });
        }
        
        const user = await User.findOne({ where: { username, password } });
        if (!user) {
            return res.status(401).json({ error: '用户名或密码错误' });
        }
        
        const token = generateToken(user);
        
        res.json({
            message: '登录成功',
            token,
            user: { id: user.id, username: user.username, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/admin/users', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: '权限不足' });
        }
        
        const { username, password, role } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: '请提供用户名和密码' });
        }
        
        const existingUser = await User.findOne({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ error: '用户名已存在' });
        }
        
        const user = await User.create({
            username,
            password,
            role: role || 'user'
        });
        
        res.json({
            message: '用户创建成功',
            user: { id: user.id, username: user.username, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/user', authenticateToken, async (req, res) => {
    res.json({ user: req.user });
});

app.put('/api/user/password', authenticateToken, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const userId = req.user.id;
        
        if (!oldPassword || !newPassword) {
            return res.status(400).json({ error: '请提供旧密码和新密码' });
        }
        
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        if (user.password !== oldPassword) {
            return res.status(400).json({ error: '旧密码错误' });
        }
        
        await user.update({ password: newPassword });
        
        res.json({ message: '密码修改成功' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/user/username', authenticateToken, async (req, res) => {
    try {
        const { newUsername, password } = req.body;
        const userId = req.user.id;
        
        if (!newUsername || !password) {
            return res.status(400).json({ error: '请提供新用户名和密码' });
        }
        
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: '用户不存在' });
        }
        
        if (user.password !== password) {
            return res.status(400).json({ error: '密码错误' });
        }
        
        const existingUser = await User.findOne({ where: { username: newUsername } });
        if (existingUser) {
            return res.status(400).json({ error: '用户名已存在' });
        }
        
        await user.update({ username: newUsername });
        
        const token = generateToken(user);
        
        res.json({ 
            message: '用户名修改成功',
            token,
            user: { id: user.id, username: user.username, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/upload', authenticateToken, async (req, res) => {
    try {
        const { examName, grades, originalFilename } = req.body;
        const username = req.user.username;
        
        if (!examName || !grades || !Array.isArray(grades)) {
            return res.status(400).json({ error: '请提供考试名称和成绩数据' });
        }
        
        let exam = await Exam.findOne({ where: { examName } });
        
        if (exam) {
            await Grade.destroy({ where: { examId: exam.id } });
            exam.uploader = username;
            exam.uploadDate = new Date();
            await exam.save();
        } else {
            exam = await Exam.create({
                examName,
                uploader: username
            });
        }
        
        const validGrades = [];
        let invalidCount = 0;
        
        for (const grade of grades) {
            if (!grade.姓名 && !grade.name) {
                invalidCount++;
                continue;
            }
            
            const studentName = grade.姓名 || grade.name || '';
            const studentId = grade.学号 || grade.id || grade.studentId || '';
            
            await Grade.create({
                examId: exam.id,
                studentName,
                studentId: String(studentId),
                data: grade
            });
            
            validGrades.push(grade);
        }
        
        await UploadLog.create({
            username,
            filename: originalFilename,
            action: 'upload',
            details: {
                recordCount: validGrades.length,
                invalidCount,
                examName
            }
        });
        
        res.json({
            message: '成绩上传成功',
            recordCount: validGrades.length,
            invalidCount
        });
    } catch (error) {
        await UploadLog.create({
            username: req.user.username,
            action: 'error',
            details: { error: error.message }
        });
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/grades', async (req, res) => {
    try {
        const { studentName, studentId } = req.query;
        
        if (!studentName || !studentId) {
            return res.status(400).json({ error: '请提供姓名和学号' });
        }
        
        const exams = await Exam.findAll({
            include: [{
                model: Grade,
                where: {
                    studentName: studentName,
                    studentId: String(studentId)
                },
                required: true
            }],
            order: [['createdAt', 'DESC']]
        });
        
        const results = [];
        for (const exam of exams) {
            const grades = await Grade.findAll({
                where: {
                    examId: exam.id,
                    studentName: studentName,
                    studentId: String(studentId)
                }
            });
            
            for (const grade of grades) {
                results.push({
                    examName: exam.examName,
                    grade: grade.data,
                    uploadDate: exam.uploadDate || exam.createdAt
                });
            }
        }
        
        results.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
        
        if (results.length === 0) {
            return res.json({ message: '未找到匹配的记录', results: [] });
        }
        
        res.json({ results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/exams', async (req, res) => {
    try {
        const exams = await Exam.findAll({
            attributes: ['id', 'examName', 'uploader', 'createdAt'],
            order: [['createdAt', 'DESC']]
        });
        res.json(exams);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/logs', authenticateToken, async (req, res) => {
    try {
        const logs = await UploadLog.findAll({
            order: [['createdAt', 'DESC']],
            limit: 100
        });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/users', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: '权限不足' });
        }
        const users = await User.findAll({
            attributes: ['id', 'username', 'role', 'createdAt'],
            order: [['createdAt', 'DESC']]
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: '权限不足' });
        }
        const userId = parseInt(req.params.id);
        if (userId === req.user.id) {
            return res.status(400).json({ error: '不能删除当前登录用户' });
        }
        await User.destroy({ where: { id: userId } });
        res.json({ message: '用户删除成功' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/admin/exams/:id', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: '权限不足' });
        }
        const examId = parseInt(req.params.id);
        await Grade.destroy({ where: { examId } });
        await Exam.destroy({ where: { id: examId } });
        res.json({ message: '考试删除成功' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/admin/grades', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: '权限不足' });
        }
        const examId = req.query.examId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        
        const where = examId ? { examId: parseInt(examId) } : {};
        
        const { count, rows: grades } = await Grade.findAndCountAll({
            where,
            include: [{ model: Exam, attributes: ['examName'] }],
            limit,
            offset,
            order: [['createdAt', 'DESC']]
        });
        
        res.json({
            grades,
            total: count,
            page,
            totalPages: Math.ceil(count / limit)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date(),
        activeRequests,
        maxConcurrent: MAX_CONCURRENT_REQUESTS,
        loadPercentage: Math.round((activeRequests / MAX_CONCURRENT_REQUESTS) * 100)
    });
});

app.get('/api/status', (req, res) => {
    const loadPercentage = Math.round((activeRequests / MAX_CONCURRENT_REQUESTS) * 100);
    res.json({
        activeRequests,
        maxConcurrent: MAX_CONCURRENT_REQUESTS,
        loadPercentage,
        status: loadPercentage > 80 ? 'busy' : loadPercentage > 50 ? 'moderate' : 'normal',
        message: loadPercentage > 80 ? '当前访问人数较多' : '系统运行正常'
    });
});

app.use(express.static(path.join(__dirname, '..')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

async function initDatabase() {
    try {
        const syncOptions = NODE_ENV === 'production' ? { force: false } : { force: true };
        await sequelize.sync(syncOptions);
        console.log('数据库同步完成');
        
        const adminUser = await User.findOne({ where: { username: 'admin' } });
        if (!adminUser) {
            await User.create({
                username: 'admin',
                password: '123456',
                role: 'admin'
            });
            console.log('默认管理员账户已创建: admin / 123456');
        }
    } catch (error) {
        console.error('数据库初始化失败:', error);
    }
}

app.listen(PORT, '0.0.0.0', async () => {
    console.log(`服务器运行在 http://0.0.0.0:${PORT}`);
    await initDatabase();
});

module.exports = app;
