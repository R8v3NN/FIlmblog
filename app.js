const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/images'); // Tworzy folder 'images' w folderze 'public'
    },
    filename: function (req, file, cb) {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');

const session = require('express-session');
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true
}));
//Logowanie uzytkownika
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    let db = new sqlite3.Database('./blog_database.db', (err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Connected to the blog_database.db.');
    });

    const selectUserQuery = "SELECT * FROM \"USER\" WHERE LOGIN = ? AND PASSWORD = ?";
    db.get(selectUserQuery, [username, password], (err, row) => {
        if (err) {
            return console.error(err.message);
        }

        if (!row) {
            res.status(401).send('User does not exist');
            return;
        }

        req.session.user = row.LOGIN;
        req.session.user_id = row.ID_USER;

        res.redirect('/dashboard');
    });
    
});

app.get('/register.html', (req, res) => {
    res.sendFile(__dirname + '/register.html');
});

app.post('/register', (req, res) => {
    const { username, password, confirm_password } = req.body;

    if (password !== confirm_password) {
        res.status(400).send('Passwords do not match');
        return;
    }

    let db = new sqlite3.Database('./blog_database.db', (err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Connected to the blog_database.db.');
    });

    const checkUserExistsQuery = "SELECT * FROM \"USER\" WHERE LOGIN = ?";
    db.get(checkUserExistsQuery, [username], (err, row) => {
        if (err) {
            return console.error(err.message);
        }

        if (row) {
            res.status(400).send('User already exists');
            return;
        }

        const insertUserQuery = `INSERT INTO \"USER\" (LOGIN, PASSWORD) VALUES (?, ?)`;
        db.run(insertUserQuery, [username, password], function(err) {
            if (err) {
                return console.error(err.message);
            }
            console.log(`A row has been inserted with rowid ${this.lastID}`);
            req.session.user = username;
            req.session.user_id = this.lastID;
            res.redirect('/dashboard?registrationSuccess=true');
        });
    });

    db.close();
});
//Obsługa view do dashboard
app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        res.redirect('/login.html');
        return;
    }

    let db = new sqlite3.Database('./blog_database.db', (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }
        console.log('Connected to the blog_database.db.');

        const selectPostsQuery = `
            SELECT 
                FILM_POST.ID_POST,
                FILM_POST.FILM_NAME,
                FILM_POST.FILM_DIRACTOR,
                FILM_POST.FILM_PREMIER,
                FILM_POST.FILM_POSTER,
                FILM_POST.SHORT_DSC,
                FILM_POST.LONG_DSC,
                COUNT(COMMENTS.ID_COMMENT) AS COMMENT_COUNT
            FROM 
                FILM_POST
            LEFT JOIN 
                COMMENTS ON FILM_POST.ID_POST = COMMENTS.ID_POST
            GROUP BY 
                FILM_POST.ID_POST;
        `;
        
        db.all(selectPostsQuery, (err, rows) => {
            if (err) {
                db.close();
                return console.error(err.message);
            }
                
            // Read image files from disk
            rows.forEach(row => {
                if (row.FILM_POSTER) {
                    row.FILM_POSTER = '/images/' + row.FILM_POSTER; // Assuming your images are stored in the public/images directory
                }
            });

            res.render('dashboard', { 
                FILM_POST: rows, // Pass FILM_POST to the view
                user: req.session.user
            });

            db.close();
        });
    });
});
app.get('/index', (req, res) => {
    let db = new sqlite3.Database('./blog_database.db', (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }
        console.log('Connected to the blog_database.db.');

        const selectPostsQuery = `
            SELECT 
                FILM_POST.ID_POST,
                FILM_POST.FILM_NAME,
                FILM_POST.FILM_DIRACTOR,
                FILM_POST.FILM_PREMIER,
                FILM_POST.FILM_POSTER,
                FILM_POST.SHORT_DSC,
                FILM_POST.LONG_DSC,
                COUNT(COMMENTS.ID_COMMENT) AS COMMENT_COUNT
            FROM 
                FILM_POST
            LEFT JOIN 
                COMMENTS ON FILM_POST.ID_POST = COMMENTS.ID_POST
            GROUP BY 
                FILM_POST.ID_POST;
        `;
        
        db.all(selectPostsQuery, (err, rows) => {
            if (err) {
                db.close();
                return console.error(err.message);
            }
                
            // Read image files from disk
            rows.forEach(row => {
                if (row.FILM_POSTER) {
                    row.FILM_POSTER = '/images/' + row.FILM_POSTER; // Assuming your images are stored in the public/images directory
                }
            });

            res.render('index', { 
                FILM_POST: rows // Pass FILM_POST to the view
            });

            db.close();
        });
    });

});

//Wyświetlanie selecta z rodzajami filmów
app.get('/add-post', (req, res) => {
    if (!req.session.user) {
        res.redirect('/login.html');
        return;
    }

    let db = new sqlite3.Database('./blog_database.db', (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }
        console.log('Connected to the blog_database.db.');

        const selectGenresQuery = `SELECT TAGS_NAME.ID_TAG ,TAGS_NAME.TAG_NAME FROM TAGS_NAME;`;

        db.all(selectGenresQuery, (err, rows) => {
            if (err) {
                db.close();
                return console.error(err.message);
            }

            res.render('add-post', { 
                TAGS_NAME: rows, // Pass FILM_GENRES to the view
                user: req.session.user
            });

            db.close();
        });
    });
});
//Dodawanie posta do bazy 
app.post('/add-post', upload.single('FILM_POSTER'), (req, res) => {
    if (!req.session.user) {
        res.redirect('/login.html');
        return;
    }

    const { FILMNAME, FILMDIRACTOR, FILMPREMIER, ID_TAG, FILMSHORTDSC, FILMLONGDSC } = req.body;
    let FILM_POSTER = req.file ? req.file.filename : null; // Zmieniamy zapis na nazwę pliku

    if (!FILM_POSTER) {
        res.status(400).send('Poster file is required');
        return;
    }

    // Sprawdź czy plik ma rozszerzenie PNG
    const extension = path.extname(req.file.originalname).toLowerCase();
    if (extension !== '.png') {
        // Jeśli nie jest to plik PNG, usuń plik i wyślij odpowiedź błędu
        fs.unlinkSync(req.file.path);
        res.status(400).send('Only PNG files are allowed');
        return;
    }

    let db = new sqlite3.Database('./blog_database.db', (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }
        console.log('Connected to the blog_database.db.');

        const insertPostQuery = `INSERT INTO FILM_POST (ID_USER, FILM_NAME, FILM_DIRACTOR, FILM_PREMIER, FILM_POSTER, SHORT_DSC, LONG_DSC) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const insertPostTagQuery = `INSERT INTO POSTTAG (ID_TAG, ID_POST) VALUES (?, ?)`;

        db.run(insertPostQuery, [req.session.user_id, FILMNAME, FILMDIRACTOR, FILMPREMIER, FILM_POSTER, FILMSHORTDSC, FILMLONGDSC], function (err) {
            if (err) {
                db.close();
                // Jeśli wystąpił błąd, usuń plik i wyślij odpowiedź błędu
                fs.unlinkSync(`public/images/${FILM_POSTER}`);
                return console.error(err.message);
            }
            const postID = this.lastID;

            db.run(insertPostTagQuery, [ID_TAG, postID], function (err) {
                if (err) {
                    db.close();
                    // Jeśli wystąpił błąd, usuń plik i wyślij odpowiedź błędu
                    fs.unlinkSync(`public/images/${FILM_POSTER}`);
                    return console.error(err.message);
                }
                res.redirect('/dashboard');
            });
        });
    });
});

app.post('/search-post', (req, res) => {
    if (!req.session.user) {
        res.redirect('/login.html');
        return;
    }
    
    const { search, FILMGENER } = req.body;
    let db = new sqlite3.Database('./blog_database.db', (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }
        console.log('Connected to the blog_database.db.');
    });
    
    try {

        let selectPostsQuery;
        let queryParams;

        if (FILMGENER === "FILM_NAME") {
            selectPostsQuery = `SELECT 
                FILM_POST.ID_POST,
                FILM_POST.FILM_NAME,
                FILM_POST.FILM_DIRACTOR,
                FILM_POST.FILM_PREMIER,
                FILM_POST.FILM_POSTER,
                FILM_POST.SHORT_DSC,
                FILM_POST.LONG_DSC
                FROM 
                FILM_POST
                WHERE FILM_POST.FILM_NAME LIKE ?;`;
        } else if (FILMGENER === "FILM_DIRACTOR") {
            selectPostsQuery = `SELECT 
                FILM_POST.ID_POST,
                FILM_POST.FILM_NAME,
                FILM_POST.FILM_DIRACTOR,
                FILM_POST.FILM_PREMIER,
                FILM_POST.FILM_POSTER,
                FILM_POST.SHORT_DSC,
                FILM_POST.LONG_DSC
                FROM 
                FILM_POST
                WHERE FILM_POST.FILM_DIRACTOR LIKE ?;`;
        } else if (FILMGENER === "FILM_PREMIER") {
            selectPostsQuery = `SELECT 
                FILM_POST.ID_POST,
                FILM_POST.FILM_NAME,
                FILM_POST.FILM_DIRACTOR,
                FILM_POST.FILM_PREMIER,
                FILM_POST.FILM_POSTER,
                FILM_POST.SHORT_DSC,
                FILM_POST.LONG_DSC
                FROM 
                FILM_POST
                WHERE FILM_POST.FILM_PREMIER LIKE ?;`;
        } else if (FILMGENER === "FILM_TAG") {
            selectPostsQuery = `SELECT 
                FILM_POST.ID_POST,
                FILM_POST.FILM_NAME,
                FILM_POST.FILM_DIRACTOR,
                FILM_POST.FILM_PREMIER,
                FILM_POST.FILM_POSTER,
                FILM_POST.SHORT_DSC,
                FILM_POST.LONG_DSC
                FROM 
                FILM_POST
                JOIN POSTTAG ON FILM_POST.ID_POST = POSTTAG.ID_POST
                JOIN TAGS_NAME ON POSTTAG.ID_TAG = TAGS_NAME.ID_TAG
                WHERE TAGS_NAME.TAG_NAME LIKE ?;`;
        }

        queryParams = [`%${search}%`];

        db.all(selectPostsQuery, queryParams, (err, rows) => {
            if (err) {
                console.error(err.message);
                return res.status(500).send('Internal Server Error');
            }

            // Read image files from disk
            rows.forEach(row => {
                if (row.FILM_POSTER) {
                    row.FILM_POSTER = '/images/' + row.FILM_POSTER; // Assuming your images are stored in the public/images directory
                }
            });

            res.render('dashboard', { 
                FILM_POST: rows, // Pass FILM_POST to the view
                user: req.session.user
            });

            db.close();
        });
    } catch (error) {
        console.error(error.message);
        db.close();
        return res.status(500).send('Internal Server Error - LostConnectionWithDatabase');
    }
});

app.get('/view-post/:id', (req, res) => {
    if (!req.session.user) {
        res.redirect('/login.html');
        return;
    }
    const postId = req.params.id;
    let db = new sqlite3.Database('./blog_database.db', (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }
        console.log('Connected to the blog_database.db.');

        const selectPostQuery = `SELECT 
            ID_POST,
            FILM_NAME,
            FILM_DIRACTOR,
            FILM_PREMIER,
            FILM_POSTER,
            LONG_DSC
            FROM 
            FILM_POST
            WHERE 
            ID_POST = ?;`;

        const selectCommentsQuery = `SELECT 
            c.ID_COMMENT,
            c.COMMENT, 
            c.COM_TIME_ADD,
            u.LOGIN AS USER_LOGIN 
            FROM COMMENTS c 
            INNER JOIN USER u ON c.ID_USER = u.ID_USER 
            WHERE c.ID_POST = ?;`;

        db.get(selectPostQuery, [postId], (err, post) => {
            if (err) {
                db.close();
                return console.error(err.message);
            }

            if (!post) {
                db.close();
                return res.status(404).send('Post Not Found');
            }

            if (post.FILM_POSTER) {
                post.FILM_POSTER = '/images/' + post.FILM_POSTER; // Assuming your images are stored in the public/images directory
            }

            db.all(selectCommentsQuery, [postId], (err, comments) => {
                if (err) {
                    db.close();
                    return console.error(err.message);
                }

                res.render('view-post', { 
                    post: post,
                    comments: comments, // Pass comments as a separate property
                    user: req.session.user
                });

                db.close();
            });
        });
    });
});

app.post('/add-comment', (req, res) => {
    // Sprawdź, czy użytkownik jest zalogowany
    if (!req.session.user || !req.session.user_id) {
        res.redirect('/login.html');
        return;
    }
    const { post_id, comment } = req.body;
    if (!comment.trim()) {
        res.redirect('/dashboard');
        return;
    }

    let db = new sqlite3.Database('./blog_database.db', (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }
        console.log('Connected to the blog_database.db.');

        try {
            const insertCommentQuery = `
            INSERT INTO COMMENTS (COMMENT, COM_TIME_ADD, ID_USER, ID_POST)
            VALUES (?, datetime('now'), ?, ?)
        `;
            db.run(insertCommentQuery, [comment, req.session.user_id, post_id], function(err) {
                if (err) {
                    console.error(err.message);
                    db.close();
                    return res.status(500).send('Internal Server Error');
                }
                console.log(`A comment has been added to post ${post_id} by user ${req.session.user_id}`);
                db.close();
                res.redirect(`/view-post/${post_id}`);
            });
        } catch (error) {
            console.error(error.message);
            db.close();
            return res.status(500).send('Internal Server Error');
        }
    });
});

app.post('/delete-comment', (req, res) => {
    if (!req.session.user || !req.session.user_id) {
        res.redirect('/login.html');
        return;
    }

    const { post_id, commentId } = req.body;

    let db = new sqlite3.Database('./blog_database.db', (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send('Internal Server Error');
        }
        console.log('Connected to the blog_database.db.');
    });

    const deleteCommentQuery = `DELETE FROM COMMENTS WHERE ID_COMMENT = ? AND ID_USER = ?`;

    db.run(deleteCommentQuery, [commentId, req.session.user_id], function(err) {
        if (err) {
            console.error(err.message);
            db.close();
            return res.status(500).send('Internal Server Error');
        }

        db.close();
        res.redirect(`/view-post/${post_id}`); // Correctly redirect using post_id
    });
});




app.use((req, res) => {
    res.status(404).send('<h1>Error 404: Resource not found</h1>');
});

app.listen(3000, () => {
    console.log("Start on port 3000");
});
