const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const date = require('date-and-time');
const CLIENT_ID = "3a4fd049caab9bebc5a8";

const connection = mysql.createConnection({
    host     : 'localhost',
    user     : 'root',
    password : '',
    database : 'stajer_db'
});

connection.connect((err) => {
    if (err) {
        console.error('MySQLe bağlanırken hata oluştu', err);
        return;
    }
    console.log('MySQL Bağlantısı Başarılı');
});

const app = express();


app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/image'));
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true,
}));


app.get('/', (req, res) => {
    const user = req.session.user;

    let error = req?.query?.error;
    if (error === 'login') {
        res.render('index', { user, error: 'login' })
    } else if (error === 'password') {
        res.render('index', { user, error: 'password' })
    } else if (error === 'username') {
        res.render('index', { user, error: 'username' })
    } else {
        res.render('index', { user, error: 'null' });
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const query = `SELECT * FROM stajer_user WHERE username = '${username}'`;
    connection.query(query, async (err, result) => {  
        if (err) {
            console.error('MySQL sorgu hatası', err);
            return;
        }
        if (result.length === 0) {
            res.redirect('/?error=login');
        } else {
            const user = result[0];
            const isPasswordCorrect = await bcrypt.compare(password, user.password);
            if (isPasswordCorrect) {
                req.session.user = user;
                res.redirect('/dashboard'); 
                console.log(user);
            } else {
                res.redirect('/?error=login');
            }
        }
    });
});

app.post('/register', (req, res) => {    
    var registerdate = date.format(new Date(), 'YYYY/MM/DD HH:mm:ss');
    const { username, email,telefon,password,confirmPassword } = req.body;
    if(password !== confirmPassword){
        res.redirect('/?error=password');
    }else{
        const role = 'Stajyer';
        const selectQuery = `SELECT * FROM stajer_user WHERE username = '${username}'`;
        console.log(selectQuery);
        connection.query(selectQuery, async (err, result) => {
            if (err) {
                console.error('MySQL sorgu hatası', err);
                return;
            }
            if( result.length > 0){
                res.redirect('/?error=username');
            }else{
                console.log('Bu kullanıcı adı daha önce alınmamış');
                const hashedPassword = await bcrypt.hash(password, 10);
                const insertQuery = `INSERT INTO stajer_user (username, email, telefon, role, password, Registration_date,staj_bitis) VALUES ('${username}', '${email}', '${telefon}', '${role}', '${hashedPassword}', '${registerdate}','${registerdate}')`;
                console.log(insertQuery);
                connection.query(insertQuery, (err, result) => {
                    if (err) {
                        console.error('MySQL sorgu hatası', err);
                        return;
                    }
                    console.log('Kullanıcı başarıyla eklendi');
                    const user = {
                        username,
                        email,
                        telefon,
                        password,
                        role
                    };
                    req.session.user = user;
                    res.redirect('/dashboard');
                });
            }
        });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/dashboard', (req, res) => {
    const user = req.session.user;
    if (!user) {
        res.redirect('/');
    } else {
        const projeListQuery = `SELECT * FROM stajer_project WHERE username = '${user.username}'`;
        const stajBitisQuery = `SELECT Registration_date, staj_bitis FROM stajer_user WHERE username = '${user.username}'`;
        const projeBitisQuery = `SELECT project_start_date,project_end_date FROM stajer_project WHERE username = '${user.username}'`;

        if (user.role === 'Stajyer') {
            connection.query(projeListQuery, (err, result) => {
                if (err) {
                    console.error('MySQL sorgu hatası', err);
                    return;
                }
                
                connection.query(stajBitisQuery, (err, stajData) => {
                    if (err) {
                        console.error('MySQL sorgu hatası   ', err);
                        return;
                    }
                    
                    const stajBitis = date.format(new Date(stajData[0].staj_bitis), 'YYYY/MM/DD');
                    const now = date.format(new Date(), 'YYYY/MM/DD');
                    const diffTime = Math.abs(new Date(now) - new Date(stajBitis));
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const progress =  Math.round((100 - (diffDays * 100) / 180));

                    connection.query(projeBitisQuery, (err, projeData) => {
                        if (err) {
                            console.error('MySQL sorgu hatası   ', err);
                            return;
                        }
                        const now = date.format(new Date(), 'YYYY/MM/DD');
                        const projeBitis = date.format(new Date(now), 'YYYY/MM/DD'); // Hata var çözülecek
                        const pdiffTime = Math.abs(new Date(now) - new Date(projeBitis));
                        const pdiffDays = Math.ceil(pdiffTime / (1000 * 60 * 60 * 24));
                        const projeProgress  =  Math.round((100 - (pdiffDays * 100) / 180));

                        const dashboardData = {
                            user,
                            stajBitis,
                            projeBitis,
                            projeListesi: result,
                            diffDays,
                            pdiffDays,
                            pdiffTime,
                            progress,
                            projeProgress
                        };

                        res.render('dashboard', dashboardData);
                    });
                });
            });
        } else {
            res.render('dashboard', { user, projeListesi: [] });
        }
    }
});


app.get('/proje-ekle', (req, res) => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());

    const user = req.session.user;
    const baslangicTarihi = date.format(new Date(), 'YYYY/MM/DD');
    const bitisTarihi = date.format(nextMonth, 'YYYY/MM/DD');
    if (!user) {
        res.redirect('/');
    } else {
        res.render('create-project', { user , baslangicTarihi, bitisTarihi});
    }
});

app.post('/projects', (req, res) => {
    const user = req.session.user;
    if (!user) {
        res.redirect('/');
    } else {
        const baslangicTarihi = date.format(new Date(), 'YYYY/MM/DD');
        const { projeAdi, projeAciklama , githubLink, bitisTarihi } = req.body;
        const insertQuery = `INSERT INTO stajer_project (username, project_name,project_about, project_link	, project_start_date, project_end_date) VALUES ('${user.username}', '${projeAdi}', '${projeAciklama}', '${githubLink}', '${baslangicTarihi}', '${bitisTarihi}')`;
        connection.query(insertQuery, (err, result) => {
            if (err) {
                console.error('MySQL sorgu hatası', err);
                return;
            }
            res.redirect('/dashboard');
        });
    }
});




app.listen(3000, () => {
    console.log('Server 3000 portunda çalışıyor');
});