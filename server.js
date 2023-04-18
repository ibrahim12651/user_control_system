const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const date = require('date-and-time');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const path = require('path');
const uuid = require('uuid');
const PDFDocument = require('pdfkit');


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
app.use(fileUpload());
app.use(session({
    secret: 'secret-key',
    resave: false,
    saveUninitialized: true,
}));

app.get('/', (req, res) => {
    const user = req.session.user;
    let error = req?.query?.error;
    if (error === 'login') {
        res.render('login-register', { user, error: 'login' })
    } else if (error === 'password') {
        res.render('login-register', { user, error: 'password' })
    } else if (error === 'username') {
        res.render('login-register', { user, error: 'username' })
    } else if (error === 'project-name-error') {
        res.render('create-project', { user, error: 'project-name-error' })
    } else {
        res.render('index', { user, error: 'null' });
    }
});
app.get('/joinorregister', (req, res) => {
    const user = req.session.user;
    res.render('login-register', { user , error: 'null'});
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
    const { username, email,telefon,password,confirmPassword,staj_Bitis } = req.body;
    if(password !== confirmPassword){
        res.redirect('/?error=password');
    }else{
        const role = 'Stajyer';
        const selectQuery = `SELECT * FROM stajer_user WHERE username = '${username}'`;
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
                const insertQuery = `INSERT INTO stajer_user (username, email, telefon, role, password, staj_baslangic,staj_bitis,staj_durumu) VALUES ('${username}', '${email}', '${telefon}', '${role}', '${hashedPassword}', '${registerdate}','${staj_Bitis}','Devam Ediyor')`;
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
                    res.redirect('/proje-ekle');
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
        const stajBitisQuery = `SELECT staj_baslangic, staj_bitis FROM stajer_user WHERE username = '${user.username}'`;
        const projeBitisQuery = `SELECT project_start_date,project_end_date FROM stajer_project WHERE username = '${user.username}'`;
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
                let stajfinal;
                let stajdurum = "Bitti";
                const stajBitis = date.format(new Date(stajData[0].staj_bitis), 'YYYY/MM/DD');
                const nowDate = date.format(new Date(), 'YYYY/MM/DD');
                const diffTime = Math.abs(new Date(nowDate) - new Date(stajBitis));
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const progress =  Math.round((100 - (diffDays * 100) / 180));

                connection.query(projeBitisQuery, (err, projeData) => {
                    if (err) {
                        console.error('MySQL sorgu hatası   ', err);
                        return;
                    }
                    const projeBitis = date.format(new Date(projeData[0].project_end_date), 'YYYY/MM/DD'); 
                    const pdiffTime = Math.abs(new Date(nowDate) - new Date(projeBitis));
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
                    if (diffDays == 0) {
                        stajfinal = `UPDATE stajer_user SET staj_durumu = 'Bitti' WHERE username = '${user.username}'`;
                        connection.query(stajfinal, (err, result) => {
                            if (err) {
                                console.error('MySQL sorgu hatası', err);
                                return;
                            }
                            stajfinal = 'Bitti'; 
                            res.redirect('/file/stajer/'+user.username+'/'+user.username+'.pdf');
                        });
                    } else if (stajdurum === user.staj_durumu) {
                        const doc = new PDFDocument();
                        doc.font('font/DejaVuSansCondensed.ttf');
                        doc.encoding = 'UTF-8';
                        
                        const filename = `public/Staj_Finish/${user.username}/${user.username}.pdf`;
                        doc.pipe(fs.createWriteStream(filename));
                        
                        doc.fontSize(20).text(`Staj bilgileri - ABC FİRMA`, { align: 'center' });
                        doc.moveDown();
                        
                        doc.fontSize(14).text(`Stajyerin Bilgileri:`);
                        doc.moveDown();
                        doc.fontSize(12).text(`Stajyer Kullanıcı Adı: ${user.username}`);
                        doc.fontSize(12).text(`Stajyer E-Mail: ${user.email}`);
                        doc.fontSize(12).text(`Stajyer Telefon: ${user.telefon}`);
                        doc.fontSize(12).text(`Staj Başlangıç Tarihi: ${stajData[0].staj_baslangic}`);
                        doc.fontSize(12).text(`Staj Bitiş Tarihi: ${stajData[0].staj_bitis}`);
                        doc.moveDown();
                                                
                        doc.fontSize(14).text('Proje Listesi:');
                        result.forEach((proje) => {
                          doc.fontSize(12).text(`Proje Adı: ${proje.project_name}`);
                          doc.fontSize(12).text(`Proje Başlangıç Tarihi: ${proje.project_start_date}`);
                          doc.fontSize(12).text(`Proje Bitiş Tarihi: ${proje.project_end_date}`);
                          doc.fontSize(12).text(`Proje Açıklaması: ${proje.project_about}`);
                          doc.moveDown();
                        });
                        
                        doc.end();
                        res.redirect('/file/stajer/'+user.username+'/'+user.username+'.pdf');
                    } else {
                        res.render('dashboard', dashboardData);
                    }
                });
            });
        });
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
        res.render('create-project', { user , baslangicTarihi, bitisTarihi , error: 'null'});
    }
});


app.post('/projects', (req, res) => {
    const user = req.session.user;
    if (!user) {
        res.redirect('/');
    } else {
        const baslangicTarihi = date.format(new Date(), 'YYYY/MM/DD');
        const { projeAdi, projeAciklama , githubLink, bitisTarihi } = req.body;
        const proje_ismi_query = `SELECT * FROM stajer_project WHERE project_name = '${projeAdi}'`;
        connection.query(proje_ismi_query, (err, result) => {
            if (err) {
                console.error('MySQL sorgu hatası', err);
                return;
            }
            if( result.length > 0){
                res.render('create-project', { error: 'project-name-error', baslangicTarihi: baslangicTarihi , bitisTarihi: bitisTarihi });
            }else{
                const insertQuery = `INSERT INTO stajer_project (username, project_name, project_about, project_start_date, project_end_date, project_link) VALUES ('${user.username}', '${projeAdi}', '${projeAciklama}', '${baslangicTarihi}', '${bitisTarihi}', '${githubLink}')`;
                connection.query(insertQuery, (err, result) => {
                    if (err) {
                        console.error('MySQL sorgu hatası', err);
                        return;
                    }
                    const userFinishFolder = __dirname + '/public/Staj_Finish/' + user.username;
                    const userFolder = __dirname + '/public/uploads/' + projeAdi;
                    fs.mkdir(userFolder, { recursive: true }, (err) => {
                        if (err) {
                            console.error('Klasör oluşturma hatası', err);
                            return;
                        }
                    });
                    fs.mkdir(userFinishFolder, { recursive: true }, (err) => {
                        if (err) {
                            console.error('Klasör oluşturma hatası', err);
                            return;
                        }
                    });
                    
                    res.redirect('dashboard');
                });

            }
        });
    }
});



app.get('/project/:projeAdi', (req, res) => {
    const user = req.session.user;
    if (!user) {
        res.redirect('/');
    } else {
        const projeAdi = req.params.projeAdi;
        const projeListQuery = `SELECT * FROM stajer_project WHERE username = '${user.username}' AND project_name = '${projeAdi}'`;
        connection.query(projeListQuery, (err, result) => {
            if (err) {
                console.error('MySQL sorgu hatası', err);
                return;
            }
            const proje = result[0];
            if (!proje) {
                res.redirect('/dashboard');
                return;
            }
                const userFolder = __dirname + '/public/uploads/' + projeAdi;
                fs.readdir(userFolder, (err, files) => {
                    if (err) {
                        console.error('Dosya okuma hatası', err);
                        return;
                    }
                    const projeDosyalari = files.filter((file) => file.startsWith(projeAdi));
                    proje.dosyalar = projeDosyalari;
                    res.render('project', { user, proje, files });

                });
        });
    }
});
app.post('/dosya-yukle', (req, res) => {
    const projeAdi = req.body.projectName;
    const user = req.session.user;
    if (!user) {
        res.redirect('/');
    } else {
        if (!req.files || !req.files.dosya) {
            res.send('Dosya seçilmedi!');
            return;
        }
        
        const userFolder = __dirname + '/public/uploads/' + projeAdi;
        if (!fs.existsSync(userFolder)) {
            fs.mkdirSync(userFolder);
        }
        
        const dosya = req.files.dosya;
        const dosyaYolu = `${userFolder}/${dosya.name}`;
        const dosyaUzantisi = dosya.name.split('.').pop().toLowerCase();

        if (dosyaUzantisi === 'exe' || dosyaUzantisi === "key" || dosyaUzantisi === "mov" ||dosyaUzantisi==="docx" ||dosyaUzantisi === "rar" || dosyaUzantisi === "xml" || dosyaUzantisi === "mp4" || dosyaUzantisi === "mp3" || dosyaUzantisi === "wav" || dosyaUzantisi === "zip" || dosyaUzantisi === 'msi' || dosyaUzantisi === 'xls' || dosyaUzantisi === 'xlsx') {
            res.send('Bu tür dosyalar yüklenemez!');
            return;
        }

        dosya.mv(dosyaYolu, (err) => {
            if (err) {
                console.error(err);
                res.status(500).send(err);
                return;
            }
            res.redirect('/project/' + projeAdi);
        });
    }
});
app.get('/file/dosya/:project_name/:dosyaAdi', (req, res) => {
    const dosyaAdi = req.params.dosyaAdi;
    const proje_name = req.params.project_name;
    const user = req.session.user;
    const path = require('path');
  
    if (!user) {
      res.redirect('/');
    } else {
      const userFolder = path.join(__dirname, 'public', 'uploads', proje_name);
      const dosyaYolu = path.join(userFolder, dosyaAdi);
      const ext = path.extname(dosyaAdi).toLowerCase();
  
      switch (ext) {
        case '.pdf':
          res.contentType('application/pdf');
          break;
        case '.jpg':
          res.contentType('image/jpg');
          break;
        case '.png':
          res.contentType('image/png');
          break;
        case '.jpeg':
          res.contentType('image/jpeg');
          break;
        case '.gif':
          res.contentType('image/gif');
          break;
        case '.jfif':
            res.contentType('image/jfif');
          break;
        default:
          fs.readFile(dosyaYolu, 'utf-8', (err, data) => {
            if (err) {
              console.error(err);
              return;
            }
            res.render('dosya', { user, dosyaAdi, dosyaIcerigi: data , path});
          });
          return;
      }
  
      fs.readFile(dosyaYolu, (err, data) => {
        if (err) {
          console.error(err);
          return;
        }
        res.send(data);
      });
    }
  });

app.get('/file/download/:project_name/:dosyaAdi', (req, res) => {
    const dosyaAdi = req.params.dosyaAdi;
    const proje_name = req.params.project_name;
    const user = req.session.user;
    if (!user) {
        res.redirect('/');
    } else {
        const userFolder = __dirname + '/public/uploads/' + proje_name;
        const dosyaYolu = `${userFolder}/${dosyaAdi}`;
        res.download(dosyaYolu);
    }
});

app.get('/file/delete/:project_name/:dosyaAdi', (req, res) => {
    const dosyaAdi = req.params.dosyaAdi; 
    const proje_name = req.params.project_name;
    const user = req.session.user;
    if (!user) {
        res.redirect('/');
    } else {
        const userFolder = __dirname + '/public/uploads/' + proje_name;
        const dosyaYolu = `${userFolder}/${dosyaAdi}`;
        fs.unlink(dosyaYolu, (err) => {
            if (err) {
                console.error('Dosya silme hatası', err);
                return;
            }
            res.redirect('/project/' + proje_name);
        });
    }
});

function removechar(str) {
    var str = str.replace(/['"]/g, "");
    return str;
  }
  

app.post('/iletisim', (req, res) => {
    const { adSoyad, email, konu, mesaj } = req.body;
    const clearchar = removechar(mesaj);
    const insertQuery = `INSERT INTO iletisim (adSoyad, email, konu, mesaj) VALUES ('${adSoyad}', '${email}', '${konu}', '${clearchar}')`;
    connection.query(insertQuery, (err, result) => {
        if (err) {
            console.error('MySQL sorgu hatası', err);
            return;
        }
        res.redirect('/dashboard');
    });
});

app.get('/iletisim/', (req, res) => {
    const user = req.session.user;
    if (!user) {
        res.redirect('/');
    } else {
        const id = req.params.id;
        const iletisimQuery = `SELECT * FROM iletisim WHERE id = '${id}'`;
        connection.query(iletisimQuery, (err, result) => {
            if (err) {
                console.error('MySQL sorgu hatası', err);
                return;
            }
            const iletisim = result[0];
            res.render('iletisim', { user, iletisim });
        });
    }
});


app.get('/admin/iletisim', (req, res) => {
    const user = req.session.user;
    if (!user) {
        res.redirect('/');
    } else {
        const iletisimQuery = `SELECT * FROM iletisim`;

        connection.query(iletisimQuery, (err, result) => {
            if(err) {
                console.error('MySQL sorgu hatası', err);
                return;
            }
            const iletisim = result;
            res.render('admin-iletisim', { user, iletisim });
        });
    }
});

app.get('/admin/iletisim/:id', (req, res) => {
    const user = req.session.user;
    if (user.role !== 'Admin') {
        res.redirect('/dashboard');
    } else {
        const id = req.params.id;
        const iletisimQuery = `SELECT * FROM iletisim WHERE id = '${id}'`;
        connection.query(iletisimQuery, (err, result) => {
            if (err) {
                console.error('MySQL sorgu hatası', err);
                return;
            }
            const iletisim = result[0];
            res.render('admin-iletisim-detay', { user, iletisim });
        });
    }
});

app.get('/admin/iletisim/delete/:id', (req, res) => {
    const user = req.session.user;
    if (!user) {
        res.redirect('/dashboard');
    } else{

        if (user.role !== 'Admin') {
            res.redirect('/dashboard'); 
        } else {
            const id = req.params.id;
            const deleteQuery = `DELETE FROM iletisim WHERE id = '${id}'`;
            connection.query(deleteQuery, (err, result) => {
                if (err) {
                    console.error('MySQL sorgu hatası', err);
                    return;
                }
                res.redirect('/admin/iletisim');
            });
        }
    }
});


app.get('/admin', function(req, res) {
    const user = req.session.user;
    if(!user) {
        res.redirect('/');
    } else {
        if (user.role !== 'Admin') {
            res.redirect('/dashboard');
        } else {       
        const randomLink = uuid.v4(); 
        const pageURL = `/admin/${randomLink}`; 
        app.get(pageURL, function(req, res) {
        const userQuery = `SELECT * FROM stajer_user`;
        const projeQuery = `SELECT * FROM stajer_project`;
        const iletisimQuery = `SELECT * FROM iletisim`;
        connection.query(userQuery, (err, result) => {
        if (err) {
            console.error('MySQL sorgu hatası', err);
            return;
        }
        const users = result;
        connection.query(projeQuery, (err, result) => {
        if (err) {
            console.error('MySQL sorgu hatası', err);
            return;
        }
        const projeler = result;
        connection.query(iletisimQuery, (err, result) => {
        if (err) {
            console.error('MySQL sorgu hatası', err);
            return;
        }
        const iletisim = result;
        res.render('admin', { user, users, projeler, iletisim });
        });
        });
        });
        });
        res.redirect(pageURL);
        setTimeout(function() {
            app._router.stack.forEach(function(route, index, routes) {
            if (route.path === pageURL && route.route.methods.get) {
                routes.splice(index, 1);
            }
            });
        }, 600000);
        }
    }
});


app.get('/admin/user/:username', (req, res) => {
    const user = req.session.user;
    if (user.role !== 'Admin') {
        res.redirect('/dashboard');
    } else {
        const username = req.params.username;
        const userQuery = `SELECT * FROM stajer_user WHERE username = '${username}'`;
        const projeQuery = `SELECT * FROM stajer_project WHERE username = '${username}'`;
        const iletisimQuery = `SELECT * FROM iletisim WHERE adSoyad = '${username}'`;

        connection.query(userQuery, (err, result) => {
            if (err) {
                console.error('MySQL sorgu hatası', err);
                return;
            }
            const users = result;
            connection.query(projeQuery, (err, result) => {
                if (err) {
                    console.error('MySQL sorgu hatası', err);
                    return;
                }
                const projeler = result;
                connection.query(iletisimQuery, (err, result) => {
                    if (err) {
                        console.error('MySQL sorgu hatası', err);
                        return;
                    }
                    const iletisim = result;
                    res.render('admin-user', { user, users, projeler, iletisim });
                });
            });
        });

    }
});


app.get('/admin/user/project/:project_name', (req, res) => {
    const user = req.session.user;
    if (user.role !== 'Admin') {
        res.redirect('/dashboard');
    } else {
        const project_name = req.params.project_name;
        const projeQuery = `SELECT * FROM stajer_project WHERE project_name = '${project_name}'`;
        
        connection.query(projeQuery, (err, result) => {
            if (err) {
                console.error('MySQL sorgu hatası', err);
                return;
            }
            const projeler = result;
            fs.readdir(`./public/uploads/${project_name}/`, (err, files) => {
                if (err) {
                    console.error('Dosya okuma hatası', err);
                    return;
                }
                res.render('admin-project', { user, projeler, files: files });
            });
        });
    }
});


app.get('/admin/dosya/:project_name/:dosyaAdi', (req, res) => {
    const dosyaAdi = req.params.dosyaAdi;
    const proje_name = req.params.project_name;
    const user = req.session.user;
    const path = require('path');
    
    if (!user) {
        res.redirect('/');
    } else {
        const userFolder = path.join(__dirname, 'public', 'uploads', proje_name);
        const dosyaYolu = path.join(userFolder, dosyaAdi);
        const ext = path.extname(dosyaAdi).toLowerCase();

        switch (ext) {
            case '.pdf':
                res.contentType('application/pdf');
                break;
              case '.jpg':
                res.contentType('image/jpg');
                break;
              case '.png':
                res.contentType('image/png');
                break;
              case '.jpeg':
                res.contentType('image/jpeg');
                break;
              case '.gif':
                res.contentType('image/gif');
                break;
              case '.jfif':
                  res.contentType('image/jfif');
                break;
            default:
                fs.readFile(dosyaYolu, 'utf-8', (err, data) => {
                    if (err) {
                        console.error(err);
                        return;
                    }
                    res.render('dosya', { user, dosyaAdi, dosyaIcerigi: data , path});
                });
                return;
        }

        fs.readFile(dosyaYolu, (err, data) => {
            if (err) {
                console.error(err);
                return;
            }
            res.send(data);
        });
    }
});

app.get('/admin/dosya/delete/:project_name/:dosyaAdi', (req, res) => {
    const dosyaAdi = req.params.dosyaAdi;
    const proje_name = req.params.project_name;
    const user = req.session.user;
    const path = require('path');
    
    if (!user) {
        res.redirect('/');
    } else {
        const userFolder = path.join(__dirname, 'public', 'uploads', proje_name);
        const dosyaYolu = path.join(userFolder, dosyaAdi);
        fs.unlink(dosyaYolu, (err) => {
            if (err) {
                console.error(err);
                return;
            }

            res.redirect(`/admin/user/project/${proje_name}`);
        });
    }
});

app.get('/admin/dosya/download/:project_name/:dosyaAdi', (req, res) => {
    const dosyaAdi = req.params.dosyaAdi;
    const proje_name = req.params.project_name;
    const user = req.session.user;
    const path = require('path');

    if (!user) {
        res.redirect('/');
    } else {
        const userFolder = path.join(__dirname, 'public', 'uploads', proje_name);
        const dosyaYolu = path.join(userFolder, dosyaAdi);
        res.download(dosyaYolu);
    }
});

app.get('/file/stajer/:username/:dosyaAdi', (req, res) => {
    const dosyaAdi = req.params.dosyaAdi;
    const username = req.params.username;
    const user = req.session.user;
    const path = require('path');
    
    if (!user) {
        res.redirect('/');
    } else if (user.username !== username) {
        res.status(401).send('Proje sahibi değilsiniz');
        return;
    } else {
        const userFolder = path.join(__dirname, 'public', 'Staj_Finish', username);
            const dosyaYolu = path.join(userFolder, dosyaAdi);
            const ext = path.extname(dosyaAdi).toLowerCase();
            
            switch (ext) {
                case '.pdf':
                    res.contentType('application/pdf');
                    break;
                default:
                    fs.readFile(dosyaYolu, 'utf-8', (err, data) => {
                        if (err) {
                            console.error(err);
                            return;
                        }
                    res.render('dosya', { user, dosyaAdi, dosyaIcerigi: data , path});
                    });
                    return;
            }
            fs.readFile(dosyaYolu, (err, data) => {
                if (err) {
                    console.error(err);
                    return;
                }
                res.send(data);
            });
        }
});

    
app.listen(3000, () => {
    console.log('Server 3000 portunda çalışıyor');
});