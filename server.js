const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');

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
            } else {
                res.redirect('/?error=login');
            }
        }
    });
});

app.post('/register', (req, res) => {
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
                const insertQuery = `INSERT INTO stajer_user (username, email, telefon, password, role) VALUES ('${username}', '${email}', '${telefon}', '${hashedPassword}', '${role}')`;
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


app.get('/dashboard', (req, res) => {
    const user = req.session.user;
    if (user) {
        res.render('dashboard', { user });
    } else {
        res.redirect('/');
    }
});









app.listen(3000, () => {
    console.log('Server 3000 portunda çalışıyor');
});