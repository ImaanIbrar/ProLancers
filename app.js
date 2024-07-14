const express = require('express');
const cookieParser = require("cookie-parser");
const sessions = require('express-session');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const ejsmate = require("ejs-mate")
const path = require("path");
const flash = require("connect-flash")
const fileUpload = require("express-fileupload")
const cors = require("cors")
const bcrypt = require('bcrypt');


const nodemailer = require('nodemailer');

// Create a transporter object
const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: 'prolancerwebsite@gmail.com',
        pass: 'yvzumfmaehebazwt'
    }
});


let connection;
const connect = async function example() {
    connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '1234',
        database: 'freelancer',
        insecureAuth: true
    });
};
connect();



const app = express();

app.use(fileUpload({
    createParentPath: true
}));
app.use(cors());
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.engine("ejs", ejsmate);
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, 'public')));

const sessionConfig = {
    secret: "thisismysecrctekey",
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7,
    },
    resave: false
};

app.use(cookieParser());
app.use(express.urlencoded({ extended: false }))
app.use(flash())
app.use(sessions(sessionConfig));
app.use((req, res, next) => {
    res.locals.current_user = req.session.__id;
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    next();
});


app.get('/browse-companies', async (req, res) => {
    const [companies] = await connection.execute(`SELECT * FROM company_setting`)
    const [details] = await connection.execute(`SELECT * FROM freelancer_profile WHERE id=(Select id from register_freelancer where status=1)`)
    res.render('hiro/hireohtml/HTML/browse-companies.ejs', { companies: companies, details: details })
})

// app.get('/dashboard-manage-bidders', (req, res) => {
//     res.render('hiro/hireohtml/HTML/dashboard-manage-bidders.ejs')
// });
app.get('/dashboard-manage-candidates/:job_id', async (req, res) => {
    const job_id = req.params.job_id

    const [row1] = await connection.execute(`SELECT * from job_applied join freelancer_profile on job_applied.freelance_id=freelancer_profile.id and job_applied.job_id="${job_id}" and job_applied.status_job NOT LIKE "%Rejected%"`)

    const [details] = await connection.execute(`SELECT * FROM company_setting WHERE company_id=(Select id from register_employer where status=1)`)
    let info1 = row1

    res.render('hiro/hireohtml/HTML/dashboard-manage-candidates.ejs', { info1: info1, details: details })
});
app.get('/dashboard-manage-jobs', async (req, res) => {
    const [details] = await connection.execute(`SELECT * FROM company_setting WHERE company_id=(Select id from register_employer where status=1)`)

    const [rows] = await connection.execute(`SELECT * FROM jobs JOIN time_posted_duration_jobs
    ON jobs.job_id = time_posted_duration_jobs.id
    WHERE jobs.post_by = (SELECT id FROM register_employer WHERE status = 1)`)
    // const [row1] = await connection.execute("SELECT avg(bid_rate) as avgbid,projectid,count(*) as count from bid group by projectid")
    let info1 = rows
    // let info2 = row1

    res.render('hiro/hireohtml/HTML/dashboard-manage-jobs.ejs', { details: details, info1: info1, calculateDuration: calculateDuration })
});
// app.get('/dashboard-manage-tasks', (req, res) => {
//     res.render('hiro/hireohtml/HTML/dashboard-manage-tasks.ejs')
// });
app.get('/dashboard-my-active-bids', async (req, res) => {
    const [row1] = await connection.execute(`SELECT * FROM bid join post_task on bid.projectid=post_task.proj_id WHERE freelancerid=(Select id from register_freelancer where status=1 )`);
    const [details] = await connection.execute(`SELECT * FROM freelancer_profile WHERE id=(Select id from register_freelancer where status=1)`)
    let info1 = row1
    console.log(info1)
    res.render('hiro/hireohtml/HTML/dashboard-my-active-bids.ejs', { info1: info1, details: details })
    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/dashboard-my-active-bids.html'));
})
app.get('/myactivejobs', async (req, res) => {
    const [row1] = await connection.execute(`SELECT * FROM job_applied join jobs on job_applied.job_id=jobs.job_id WHERE freelance_id=(Select id from register_freelancer where status=1 )`);
    const [details] = await connection.execute(`SELECT * FROM freelancer_profile WHERE id=(Select id from register_freelancer where status=1)`)
    const [row2] = await connection.execute(`SELECT * FROM job_offered_freelancer join company_setting on job_offered_freelancer.company_id=company_setting.company_id WHERE freelance_id=(Select id from register_freelancer where status=1 )`)
    let info1 = row1
    let info2 = row2
    console.log(info2)
    res.render('hiro/hireohtml/HTML/myactivejobs.ejs', { info1: info1, info2: info2, details: details })
    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/dashboard-my-active-bids.html'));
})
app.get('/dashboard-post-a-job', async (req, res) => {
    const [details] = await connection.execute(`SELECT * FROM company_setting WHERE company_id=(Select id from register_employer where status=1)`)
    res.render('hiro/hireohtml/HTML/dashboard-post-a-job.ejs', { details })
});
app.post('/dashboard-post-a-job', async (req, res) => {
    const jobtitle = req.body.job_title;
    const jobtype = req.body.job_type;
    const category = req.body.category;
    const address = req.body.address;
    const min = req.body.min;
    const max = req.body.max;
    const description = req.body.job_description;
    const upload = req.files.image_upload;
    const tag = req.body.tag;
    const values = tag.split(',')
    console.log(tag)
    console.log(values)

    const uploadpathfile = __dirname + "/public/docs/" + upload.name
    const filepath = "/docs/" + upload.name
    upload.mv(uploadpathfile, function (err) {
        if (err) return res.status(500).send(err)
    })

    const [company_id] = await connection.execute('SELECT * from register_employer where status=1');

    const query = ('INSERT INTO jobs(post_by,job_title,min,max,jobtype,jobcategory,location,job_describe,upload) VALUES (?,?,?,?,?,?,?,?,?)');
    await connection.execute(query, [company_id[0].id, jobtitle, min, max, jobtype, category, address, description, filepath]);
    const [jobbss] = await connection.execute
        ('SELECT * from jobs order by job_id Desc limit 1 ');
    for (let i = 0; i < values.length; i++) {
        const query2 = ('INSERT INTO tag(tag_name,job_id) VALUES (?,?)');
        await connection.execute(query2, [[values[i]], jobbss[0].job_id]);
    }
    await connection.execute(`INSERT INTO time_posted_duration_jobs (id) VALUES("${jobbss[0].job_id}")`)
    res.redirect("/index-company")
});


app.get('/dashboard-post-a-task', async (req, res) => {
    const [details] = await connection.execute(`SELECT * FROM company_setting WHERE company_id=(Select id from register_employer where status=1)`)

    res.render('hiro/hireohtml/HTML/dashboard-post-a-task.ejs', { details })
});
app.post('/dashboard-post-a-task', async (req, res) => {
    const pass = req.body.projectname
    const pass2 = req.body.category
    const pass3 = req.body.location
    const pass4 = req.body.min
    const pass5 = req.body.max
    const pass6 = req.body.cattime
    const pass7 = req.body.ptext
    const pass8 = req.files.upload
    const pass9 = req.body.skill
    const values = pass9.split(',')

    const uploadpathfile = __dirname + "/public/docs/" + pass8.name
    const filepath = "/docs/" + pass8.name
    pass8.mv(uploadpathfile, function (err) {
        if (err) return res.status(500).send(err)
    })



    const [company_id] = await connection.execute('SELECT * from register_employer where status=1');

    const query = (`INSERT INTO post_task (proj_by,proj_name,task_cat,proj_location,min_bud,max_bud,pr_cat_time,proj_describe,upload) VALUES (?,?,?,?,?,?,?,?,?)`);
    await connection.execute(query, [company_id[0].id, pass, pass2, pass3, pass4, pass5, pass6, pass7, filepath]);
    const [task] = await connection.execute('SELECT * from post_task order by proj_id Desc limit 1 ');
    for (let i = 0; i < values.length; i++) {
        const query2 = ('INSERT INTO task_skills(taskid,skillname) VALUES (?,?)');
        await connection.execute(query2, [task[0].proj_id, [values[i]]]);
    }
    await connection.execute(`INSERT INTO time_posted_duration_tasks (id) VALUES("${task[0].proj_id}")`)
    res.redirect("/index-company")
});



app.get('/dashboard-settings', async (req, res) => {
    // const query = `SELECT * FROM freelancer_profile WHERE id="${id[0].id}"`;

    if (!connection) {
        res.send('Error: Database connection is not established');
        return;
    }
    try {
        const [id] = await connection.execute(`SELECT id FROM register_freelancer WHERE status=1`)

        const [rows] = await connection.execute(`SELECT * FROM freelancer_profile WHERE id=${id[0].id}`);
        const [details] = await connection.execute(`SELECT * FROM freelancer_profile WHERE id=(Select id from register_freelancer where status=1)`)

        let info = rows[0]
        console.log(info.Nationality)
        const message = req.flash("mess")

        res.render('hiro/hireohtml/HTML/dashboard-settings.ejs', { info: info, message: message, details: details })
    } catch (error) {
        console.error(error);
        res.send(error);
    }
    // res.render('hiro/hireohtml/HTML/dashboard-settings.ejs')
});

app.post('/dashboard-settings', async (req, res) => {
    // const samplepic = req.files.picture
    const fname = req.body.fname
    const lname = req.body.lname
    const minRate = req.body.minRate
    const email = req.body.email
    const tagline = req.body.tagline
    const location = req.body.country
    const describe = req.body.description

    let picpath = ""
    try {
        const samplepic = req.files.picture

        const uploadpathpic = __dirname + "/public/uploads/" + samplepic.name
        picpath = "/uploads/" + samplepic.name
        samplepic.mv(uploadpathpic, function (err) {
            if (err) return res.status(500).send(err)
            // else console.log("UPLOADEDDDDDDD")
        })

    }
    catch (TypeError) {
        {
            picpath = req.body.defaultfile
        }
    }

    const query5 = `select * from register_freelancer where status = 1`
    const [id] = await connection.execute(query5);
    // console.log(id[0].pass)
    if (req.body.cpass && req.body.npass && req.body.rpass) {
        if (req.body.cpass === id[0].pass && req.body.npass === req.body.rpass) {
            await connection.execute(`UPDATE register_freelancer SET pass="${req.body.npass}"where id="${id[0].id}"`)
        }
        else {
            req.flash("mess", "Current Password Entered is not correct")
            return res.redirect("/dashboard-settings")
        }
    }
    else if (req.body.cpass || req.body.npass || req.body.rpass) {
        req.flash("mess", "Enter all pasword fields")
        return res.redirect("/dashboard-settings")
    }



    const query = `UPDATE freelancer_profile SET  f_name="${fname}",l_name="${lname}",email="${email}",min_Rate="${minRate}",tagline="${tagline}",intro="${describe}",Nationality="${location}",image="${picpath}" WHERE id=${id[0].id}`;
    console.log(query)

    await connection.execute(query)
    res.redirect("/index")

    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/findfreelancerprofilecompany.html'));
});



app.get('/detailscompany', async (req, res) => {
    // const emailaddress = req.session.__id
    let [details] = await connection.execute(`SELECT * FROM company_setting WHERE company_id=(Select id from register_employer where status=1)`)

    const [id] = await connection.execute(`SELECT * FROM register_employer WHERE status=1`)
    res.render('hiro/hireohtml/HTML/detailscompany.ejs', { emailaddress: id[0].email, details: details })
});
app.get('/detailsfreelancer', async (req, res) => {
    // const emailaddress = req.session.__id
    let [details] = await connection.execute(`SELECT * FROM freelancer_profile WHERE id=(Select id from register_freelancer where status=1)`)

    const [id] = await connection.execute(`SELECT * FROM register_freelancer WHERE status=1`)

    res.render('hiro/hireohtml/HTML/detailsfreelancer.ejs', { emailaddress: id[0].email, details: details })
});

app.get('/freelancers-grid-layout-full-page', async (req, res) => {

    let [details] = await connection.execute(`SELECT * FROM freelancer_profile WHERE id=(Select id from register_freelancer where status=1)`)
    if (!details) {
        [details] = await connection.execute(`SELECT * FROM company_setting WHERE id=(Select id from register_employer where status=1)`)
    }
    const [freelancers] = await connection.execute(`SELECT * FROM freelancer_profile`)
    res.render('hiro/hireohtml/HTML/freelancers-grid-layout-full-page.ejs', { freelancers: freelancers, details: details })


})



app.post('/freelancers-grid-layout-full-page', async (req, res) => {
    // Retrieve the form data from the request body
    const location = req.body.location;
    const keywords = req.body.keywords;
    const category = req.body.category;
    const hourlyrate = req.body.hourlyrate;
    const skills = req.body.skills
    const keywordsarray = keywords.split(',')
    const values = hourlyrate.split(',')
    const skillsarray = skills.split(',')
    console.log(category)
    // Construct the SQL query using the form data
    let sql = 'SELECT  f.* FROM freelancer_profile f WHERE 1=1';
    if (location) {
        sql += ` AND Nationality LIKE '%${location}%'`;
    }
    if (keywords) {
        for (let i = 0; i < keywordsarray.length; i++) {

            sql += ` AND (tagline LIKE '%${keywords[i]}%'`;
            sql += ` OR intro LIKE '%${keywords[i]}%')`;
        }
    }
    if (category) {
        sql += ` AND tagline IN( '${category}')`;
    }
    if (skills) {
        for (let i = 0; i < skillsarray.length; i++) {
            sql += ` AND EXISTS (SELECT 1 FROM freelancer_skills WHERE freelancer_skills.freelancerid = f.id AND freelancer_skills.skillname IN ('${skillsarray[i]}' ))`;

        }
    }
    if (values) {
        sql += ` AND min_rate >= ${parseInt(values[0])}`;
        sql += ` AND min_rate <= ${parseInt(values[1])}`
    }

    let [details] = await connection.execute(`SELECT * FROM freelancer_profile WHERE id=(Select id from register_freelancer where status=1)`)
    if (!details) {
        [details] = await connection.execute(`SELECT * FROM company_setting WHERE id=(Select id from register_employer where status=1)`)
    }

    // Execute the SQL query
    const [freelancers] = await connection.execute(sql)
    // Render the template with the filtered jobs
    res.render('hiro/hireohtml/HTML/freelancers-grid-layout-full-page.ejs', { freelancers: freelancers, details: details });

});




app.get('/index-company', async (req, res) => {
    const [id] = await connection.execute(`SELECT id FROM register_employer WHERE status=1`)
    const query = `SELECT * FROM company_setting WHERE company_id="${id[0].id}"`;
    const [details] = await connection.execute(query);
    const query1 = 'SELECT * FROM freelancer_profile LIMIT 5';
    const query3 = "SELECT count(*) as count from jobs";
    const query4 = "SELECT count(*) as count from post_task";
    const query5 = "SELECT count(*) as count from register_freelancer";
    const query6 = "SELECT count(*) as count from register_employer";

    const [freelancer] = await connection.execute(query1);
    console.log(freelancer)
    const [noofjobs] = await connection.execute(query3);
    console.log(noofjobs)
    const [nooffls] = await connection.execute(query5);
    console.log(nooffls)
    const [nooftasks] = await connection.execute(query4);
    console.log(nooftasks)
    const [noofcs] = await connection.execute(query6);
    console.log(noofcs)
    // insert user into the database
    res.render('hiro/hireohtml/HTML/index-company.ejs', { details: details, freelancer: freelancer, noofjobs: noofjobs, nooffls: nooffls, nooftasks: nooftasks, noofcs: noofcs })
})



app.get('/index-logged-out', async (req, res) => {
    const query1 = 'SELECT * FROM freelancer_profile LIMIT 5';
    const query2 = 'SELECT * FROM jobs LIMIT 5';
    const query3 = "SELECT count(*) as count from jobs";
    const query4 = "SELECT count(*) as count from post_task";
    const query5 = "SELECT count(*) as count from register_freelancer";
    const query6 = "SELECT count(*) as count from register_employer";
    const [freelancer] = await connection.execute(query1);
    const [jobs] = await connection.execute(query2);
    const [noofjobs] = await connection.execute(query3);
    const [nooffls] = await connection.execute(query5);
    const [nooftasks] = await connection.execute(query4);
    const [noofcs] = await connection.execute(query6);


    res.render('hiro/hireohtml/HTML/index-logged-out.ejs', { freelancer: freelancer, jobs: jobs, noofjobs: noofjobs, nooffls: nooffls, nooftasks: nooftasks, noofcs: noofcs })
    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/freelancers-grid-layout-full-page.html'));
})

app.get('/index', async (req, res) => {
    // const email = 'abdauallah.tahirr7@gmail.com';
    const [id] = await connection.execute(`SELECT id FROM register_freelancer WHERE status=1`)
    const query = `SELECT * FROM freelancer_profile WHERE id="${id[0].id}"`;
    const query1 = 'SELECT * FROM freelancer_profile LIMIT 5';
    const query2 = 'SELECT * FROM jobs join company_setting on jobs.post_by=company_setting.company_id LIMIT 5 ';
    const query3 = "SELECT count(*) as count from jobs";
    const query4 = "SELECT count(*) as count from post_task";
    const query5 = "SELECT count(*) as count from register_freelancer";
    const query6 = "SELECT count(*) as count from register_employer";
    const [freelancer] = await connection.execute(query1);
    const [details] = await connection.execute(query);
    const [jobs] = await connection.execute(query2);
    console.log(jobs)
    const [noofjobs] = await connection.execute(query3);
    const [nooffls] = await connection.execute(query5);
    const [nooftasks] = await connection.execute(query4);
    const [noofcs] = await connection.execute(query6);

    res.render('hiro/hireohtml/HTML/index.ejs', { details: details, freelancer: freelancer, jobs: jobs, noofjobs: noofjobs, nooffls: nooffls, nooftasks: nooftasks, noofcs: noofcs })
    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/index.ejs'));
});





app.get('/jobs-grid-layout-full-page', async (req, res) => {
    // const [jobs] = await connection.execute(`SELECT * FROM jobs JOIN company_setting ON( jobs.post_by=company_setting.company_id ) JOIN time_posted_duration_jobs ON( jobs.post_by=time_posted_duration_jobs.id)`);
    const [details] = await connection.execute(`SELECT * FROM freelancer_profile WHERE id=(Select id from register_freelancer where status=1)`)

    const [jobs] = await connection.execute(`SELECT * FROM view_jobs`)
    // console.log(jobs)
    res.render('hiro/hireohtml/HTML/jobs-grid-layout-full-page.ejs', { jobs: jobs, calculateDuration: calculateDuration, details: details })
    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/jobs-grid-layout-full-page.html'));
});

app.post('/jobs-grid-layout-full-page', async (req, res) => {
    // Retrieve the form data from the request body
    // const formData = req.body;
    const [details] = await connection.execute(`SELECT * FROM freelancer_profile WHERE id=(Select id from register_freelancer where status=1)`)

    const location = req.body.location;
    const keywords = req.body.keywords;
    const category = req.body.category;
    const job_type = req.body.job_type;
    const min = req.body.min;
    const max = req.body.max;
    console.log(category)
    // Construct the SQL query using the form data
    let sql = 'SELECT * FROM view_jobs WHERE 1=1';
    if (location) {
        sql += ` AND location LIKE '%${location}%'`;
    }
    if (keywords) {
        sql += ` AND( job_title LIKE '%${keywords}%'`;
        sql += ` OR job_describe LIKE '%${keywords}%'`;
        sql += ` OR jobcategory LIKE '%${keywords}%'`
        sql += ` OR tag_name LIKE '%${keywords}%')`;
    }
    if (category) {
        sql += ` AND jobcategory LIKE( '%${category}%')`;
    }

    if (job_type) {
        sql += ` AND jobtype = '${job_type}'`;
    }
    if (min) {
        sql += ` AND min >= '${min}'`;
    }
    if (max) {
        sql += ` AND max <= '${max}'`;
    }
    // Execute the SQL query
    const [jobs] = await connection.execute(sql)
    // Render the template with the filtered jobs
    res.render('hiro/hireohtml/HTML/jobs-grid-layout-full-page.ejs', { details: details, jobs: jobs, calculateDuration: calculateDuration });

});



app.get('/nomore', (req, res) => {
    res.render('hiro/hireohtml/HTML/nomore.ejs')
    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/jobs-grid-layout-full-page.html'));
});
app.get('/pages-404', (req, res) => {
    res.render('hiro/hireohtml/HTML/pages-404.ejs')
    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/jobs-grid-layout-full-page.html'));
});
app.get('/pages-contact', (req, res) => {
    res.render('hiro/hireohtml/HTML/pages-contact.ejs')
    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/pages-contact.html'));
});
app.get('/pages-icon-cheatsheet', (req, res) => {
    res.render('hiro/hireohtml/HTML/pages-icon-cheatsheet.ejs')
    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/pages-contact.html'));
});
app.get('/pages-login', (req, res) => {
    const message = req.flash("mess")
    res.render('hiro/hireohtml/HTML/pages-login', { message })
    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/pages-login.html'));
});
app.get('/pages-register', (req, res) => {
    const message = req.flash("mess")
    res.render('hiro/hireohtml/HTML/pages-register.ejs', { message })
    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/pages-login.html'));
});
app.get('/pages-user-interface-elements', (req, res) => {
    res.render('hiro/hireohtml/HTML/pages-user-interface-elements.ejs')
    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/pages-login.html'));
});
app.get('/privacy', (req, res) => {
    res.render('hiro/hireohtml/HTML/privacy.ejs')
    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/privacy.html'));
});
app.get('/setting-company', async (req, res) => {
    const [id] = await connection.execute(`SELECT id FROM register_employer WHERE status=1`)
    const query = `SELECT * FROM company_setting WHERE company_id="${id[0].id}"`;
    const [details] = await connection.execute(query);
    const message = req.flash("mess")

    res.render('hiro/hireohtml/HTML/setting-company.ejs', { details: details, message: message })
});

app.post('/setting-company', async (req, res) => {
    const cname = req.body.cname
    const email = req.body.email
    const type = req.body.type
    const location = req.body.location
    const describe = req.body.description
    let picpath = ""
    try {
        const samplepic = req.files.picture

        const uploadpathpic = __dirname + "/public/uploads/" + samplepic.name
        picpath = "/uploads/" + samplepic.name
        samplepic.mv(uploadpathpic, function (err) {
            if (err) return res.status(500).send(err)
            // else console.log("UPLOADEDDDDDDD")
        })

    }
    catch (TypeError) {
        {
            picpath = req.body.defaultfile
        }
    }


    const query5 = `select * from register_employer where status = 1`
    const [id] = await connection.execute(query5);
    console.log(req.body)

    if (req.body.cpass && req.body.npass && req.body.rpass) {
        if (req.body.cpass === id[0].pass && req.body.npass === req.body.rpass) {
            await connection.execute(`UPDATE register_employer SET pass="${req.body.npass}" WHERE id=${id[0].id}`)
        }
        else {
            req.flash("mess", "Current Password Entered is not correct")
            return res.redirect("/setting-company")
        }
    }
    else if (req.body.cpass || req.body.npass || req.body.rpass) {
        req.flash("mess", "Enter all pasword fields")
        return res.redirect("/setting-company")
    }

    const query = `UPDATE company_setting SET  companyname="${cname}",email="${email}",companytype="${type}",intro="${describe}",headquarter="${location}",image="${picpath}" WHERE company_id=${id[0].id}`;
    console.log(query)

    await connection.execute(query)
    res.redirect("/index-company")

    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/findfreelancerprofilecompany.html'));
});
app.post("/detailsfreelancer", async (req, res) => {
    const tag = req.body.skills
    const tags = tag.split(',')

    const samplepic = req.files.picture
    const fname = req.body.fname
    const lname = req.body.lname
    const email = req.body.email
    const rate = req.body.minRate
    const file = req.files.upload


    const tagline = req.body.tagline
    const country = req.body.country
    const describe = req.body.description

    // console.log(req.body)


    const uploadpathpic = __dirname + "/public/uploads/" + samplepic.name
    const picpath = "/uploads/" + samplepic.name
    const uploadpathfile = __dirname + "/public/docs/" + file.name
    const filepath = "/docs/" + file.name

    samplepic.mv(uploadpathpic, function (err) {
        if (err) return res.status(500).send(err)
        // else console.log("UPLOADEDDDDDDD")
    })
    file.mv(uploadpathfile, function (err) {
        if (err) return res.status(500).send(err)
    })

    // console.log("here")
    const query5 = `select id from register_freelancer where email = "${email}"`
    const [id] = await connection.execute(query5);
    // console.log(id[0].id)

    const query = `INSERT INTO freelancer_profile (id,f_name,l_name,email,min_rate,tagline,Nationality,intro,cover_letter,image) 
    VALUES ("${id[0].id}","${fname}","${lname}","${email}","${rate}","${tagline}","${country}","${describe}","${filepath}","${picpath}")`;
    await connection.execute(query)

    if (tag) {
        for (let i = 0; i < tags.length; i++) {
            await connection.execute(`INSERT INTO freelancer_skills (freelancerid,skillname) VALUES("${id[0].id}","${tags[i]}")`)
        }
    }
    res.redirect("/index")

})






app.get('/tasks-grid-layout-full-page', async (req, res) => {
    const [details] = await connection.execute(`SELECT * FROM freelancer_profile WHERE id=(Select id from register_freelancer where status=1)`)

    const [tasks] = await connection.execute(`SELECT * FROM view_tasks`)
    // console.log(tasks)
    res.render('hiro/hireohtml/HTML/tasks-grid-layout-full-page.ejs', { tasks: tasks, calculateDuration: calculateDuration, details: details })
    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/tasks-grid-layout-full-page.html'));
});

app.post('/tasks-grid-layout-full-page', async (req, res) => {
    // Retrieve the form data from the request body
    // const formData = req.body;
    const tag = req.body.skills

    // const tag = Object.values(request.body).filter(value => value === 'on');
    // const range = req.body.raterange;
    const budgetrange = req.body.budgetrange;
    const category = req.body.category;
    const location = req.body.location;

    const values = budgetrange.split(',')
    const tags = tag.split(',')

    console.log(tags)
    // Construct the SQL query using the form data

    let sql = 'SELECT v.* FROM view_tasks v WHERE 1=1';
    const params = [];
    if (location) {
        sql += ' AND proj_location LIKE ?';
        params.push(`%${location}%`);
    }
    if (category) {
        sql += ' AND proj_name IN(?)';
        params.push(category);
    }
    if (tag) {
        for (let i = 0; i < tags.length; i++) {
            sql += ' AND EXISTS (SELECT 1 FROM task_skills WHERE task_skills.taskid = v.proj_id AND task_skills.skillname IN (?))';
            params.push(tags[i]);
        }
    }
    if (budgetrange) {
        sql += ' AND min_bud >= ?';
        params.push(parseInt(values[0]));
        sql += ' AND max_bud <= ?';
        params.push(parseInt(values[1]));
    }

    console.log(params)
    console.log(sql)

    const [tasks] = await connection.execute(sql, params)
    const [details] = await connection.execute(`SELECT * FROM freelancer_profile WHERE id=(Select id from register_freelancer where status=1)`)

    res.render('hiro/hireohtml/HTML/tasks-grid-layout-full-page.ejs', { tasks: tasks, calculateDuration: calculateDuration, details: details });

});

app.get('/termsofuse', (req, res) => {
    res.render('hiro/hireohtml/HTML/termsofuse.ejs')
    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/termsofuse.html'));
});

app.get('/logout/company', async (req, res) => {

    await connection.execute(`UPDATE register_employer SET status=0 where status=1`)
    res.redirect('/pages-login');

});
app.get('/logout/freelancer', async (req, res) => {

    await connection.execute(`UPDATE register_freelancer SET status=0 where status=1`)
    res.redirect('/pages-login');

});



app.post('/pages-register', async (req, res) => {
    const email = req.body.emailaddress
    const hash = await bcrypt.hash(req.body.password, 12);
    const type = req.body.accountType
    const values = [email, hash, 1]

    // console.log(email, pass)

    if (type == "freelancer") {
        const [rows1] = await connection.execute(`select * from register_freelancer where email="${email}"`);
        if (rows1[0]) {
            req.flash("mess", "Freelancer account already exists, go to signin!");
            return res.redirect("/pages-register")
        }
        else {
            const query = `INSERT INTO register_freelancer (email,pass,status) VALUES (?,?,?)`;
            // insert user into the database

            await connection.execute(query, values)
            // req.session.__id = email;

            res.redirect('/detailsfreelancer')
        }
    }
    else if (type == "employer") {

        const [rows1] = await connection.execute(`select * from register_employer where email="${email}"`);
        if (rows1[0]) {
            req.flash("mess", "Employer account already exists, go to signin!");
            return res.redirect("/pages-register")
        }
        else {
            const query = `INSERT INTO register_employer (email,pass,status) VALUES (?,?,?)`;
            // insert user into the database

            await connection.execute(query, values);
            // req.session.__id = email;

            res.redirect('/detailscompany')
        }
    }
});
app.post('/detailscompany', async (req, res) => {
    const samplepic = req.files.picture
    const cname = req.body.cname
    const email = req.body.email
    const file = req.files.upload
    const type = req.body.type
    const location = req.body.location
    const describe = req.body.description

    const uploadpathpic = __dirname + "/public/uploads/" + samplepic.name
    const picpath = "/uploads/" + samplepic.name
    const filepath = "/docs/" + file.name
    const uploadpathfile = __dirname + "/public/docs/" + file.name

    samplepic.mv(uploadpathpic, function (err) {
        if (err) return res.status(500).send(err)
        // else console.log("UPLOADEDDDDDDD")
    })
    file.mv(uploadpathfile, function (err) {
        if (err) return res.status(500).send(err)
        // else console.log("UPLOADEDDDDDDD")
    })

    const query5 = `select id from register_employer where email = "${email}"`
    const [id] = await connection.execute(query5);
    console.log(req.body, req.body.email, email, id)

    const query = `INSERT INTO company_setting (companyname,company_id,email,companytype,intro,coverletter,image,headquarter) 
    VALUES ("${cname}","${id[0].id}","${email}","${type}","${describe}","${filepath}","${picpath}","${location}")`;
    await connection.execute(query)
    res.redirect("/index-company")


    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/findfreelancerprofilecompany.html'));
});
// app.post("/detailsfreelancer", async (req, res) => {

//     const samplepic = req.files.picture
//     const fname = req.body.fname
//     const lname = req.body.lname
//     const email = req.body.email
//     const rate = req.body.minRate
//     const file = req.files.upload
//     const tagline = req.body.tagline
//     const country = req.body.country
//     const describe = req.body.description

//     // console.log(req.body)


//     const uploadpathpic = __dirname + "/public/uploads/" + samplepic.name
//     const uploadpathfile = __dirname + "/public/docs/" + file.name
//     const picpath = "/uploads/" + samplepic.name
//     const filepath = "/docs/" + file.name

//     samplepic.mv(uploadpathpic, function (err) {
//         if (err) return res.status(500).send(err)
//         // else console.log("UPLOADEDDDDDDD")
//     })
//     samplepic.mv(uploadpathfile, function (err) {
//         if (err) return res.status(500).send(err)
//         // else console.log("UPLOADEDDDDDDD")
//     })

//     // console.log("here")
//     const query5 = `select id from register_freelancer where email = "${email}"`
//     const [id] = await connection.execute(query5);
//     // console.log(id[0].id)

//     const query = `INSERT INTO freelancer_profile (id,f_name,l_name,email,min_rate,tagline,Nationality,intro,cover_letter,image) 
//     VALUES ("${id[0].id}","${fname}","${lname}","${email}","${rate}","${tagline}","${country}","${describe}","${filepath}","${picpath}")`;
//     await connection.execute(query)
//     res.redirect("/index")

// })

app.get("/show", (req, res) => {
    let user = ["Abdullah", "imnm", "urqn"]
    res.render("show.ejs", { user })
})


app.post('/signup', (req, res) => {
    const username1 = req.body.username3;
    const password2 = req.body.password3;
    const query = `INSERT INTO signup (username,password) VALUES ("${username1}","${password2}")`;


    // insert user into the database
    connection.query(
        query,
        (error, results) => {
            if (error) {
                return res.send(error);
            }
            res.send('User successfully created');
        }
    );
});


app.post('/pages-login', async (req, res) => {
    const email = req.body.emailaddress;
    const hash = await bcrypt.hash(req.body.password, 12);

    const AccPassword = req.body.password;
    const type = req.body.accountType
    const [rows] = await connection.execute(
        `select * from register_freelancer where Email="${email}"`
    );
    if (type == "freelancer") {
        if (rows[0]) {
            const validPass = await bcrypt.compare(AccPassword, rows[0].pass)
            if (validPass) {
                await connection.execute(`Update register_freelancer SET status=1 where Email="${email}"`)
                req.flash("success", "Logged in Successfully");
                // req.session.__id = email;

                res.redirect("/index");
            } else {
                req.flash("mess", "Incorrect Id or Password");
                res.redirect("/pages-login");
            }
        } else {
            req.flash("mess", "Incorrect Id or Password");
            res.redirect("/pages-login");
        }
    }
    else if (type == "employer") {
        if (rows[0]) {
            const validPass = await bcrypt.compare(AccPassword, rows[0].pass);
            if (validPass) {
                await connection.execute(`Update register_employer SET status=1 where Email="${email}"`)
                req.flash("mess", "Logged in Successfully");
                // req.session.__id = email;
                res.redirect("/index-company");
            } else {
                req.flash("mess", "Incorrect Id or Password");
                res.redirect("/pages-login");
            }
        } else {
            req.flash("mess", "Incorrect Id or Password");
            res.redirect("/pages-login");
        }
    }

});

app.listen(3000, () => {
    console.log('Server listening on port 3000');
});

function calculateDuration(startTime) {
    // Parse the start and end times into Date objects
    const start = new Date(startTime);
    const currentTime = new Date();
    // Calculate the difference in milliseconds
    const diff = currentTime - start;

    // Convert the difference to years, weeks, days, hours, minutes, and seconds
    const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
    const weeks = Math.floor((diff % (1000 * 60 * 60 * 24 * 365)) / (1000 * 60 * 60 * 24 * 7));
    const days = Math.floor((diff % (1000 * 60 * 60 * 24 * 7)) / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    // Return the duration in the most appropriate unit
    if (years > 0) {
        return `${years} years`;
    } else if (weeks > 0) {
        return `${weeks} weeks`;
    } else if (days > 0) {
        return `${days} days`;
    } else if (hours > 0) {
        return `${hours} hours`;
    } else if (minutes > 0) {
        return `${minutes} minutes`;
    } else {
        return `${seconds} seconds`;
    }
}

app.get('/bidnow/:proj_id', async (req, res) => {
    const [details] = await connection.execute(`SELECT * FROM freelancer_profile WHERE id=(Select id from register_freelancer where status=1)`)

    const task_id = [req.params.proj_id];
    if (!connection) {
        res.send('Error: Database connection is not established');
        return;
    }
    try {
        const [rows] = await connection.execute(`SELECT * FROM post_task WHERE proj_id="${task_id}"`);
        const [row1] = await connection.execute(`SELECT * FROM company_setting join post_task ON company_setting.company_id=post_task.proj_by AND proj_id="${task_id}"`);
        const [row2] = await connection.execute(`SELECT * FROM bid join freelancer_profile ON bid.freelancerid=freelancer_profile.id AND bid.projectid="${task_id}"`)
        const [row3] = await connection.execute(`SELECT count(*) as count FROM bid join freelancer_profile ON bid.freelancerid=freelancer_profile.id AND bid.projectid="${task_id}"`)
        let info = rows[0]
        let info1 = row1[0]
        let info2 = row2
        let info3 = row3[0]
        // console.log(info)
        // console.log(info1)
        // console.log(info2)
        // console.log(info3)

        res.render('hiro/hireohtml/HTML/single-task-page.ejs', { info: info, info1: info1, info2: info2, info3: info3, details: details });
    } catch (error) {
        console.error(error);
        res.send(error);
    }
})

app.post("/done", async (req, res) => {
    const slidermin = req.body.sliderminbid
    const timeqty = req.body.qtyInput
    const typetime = req.body.typepicker
    const taskid = req.body.taskid

    if (!connection) {
        return res.send('Error: Database connection is not established');

    }
    try {
        const [res1] = await connection.execute(`SELECT * FROM register_freelancer WHERE status=1`);
        let info = res1[0]
        const query = ('INSERT INTO bid(projectid,freelancerid,bid_rate,deliver_num_days,deliver_type,status) VALUES (?,?,?,?,?,?)');
        await connection.execute(query, [taskid, info.id, slidermin, timeqty, typetime, "pending"]);
        return res.redirect(`/bidnow/${taskid}`)

    } catch (error) {
        console.error(error);
        return res.send(error);
    }

}
)

app.get('/browsecompanyfreelancer', async (req, res) => {
    const [details] = await connection.execute(`SELECT * FROM freelancer_profile WHERE id=(Select id from register_freelancer where status=1)`)

    const [row] = await connection.execute("SELECT * from company_setting")
    const [countrow] = await connection.execute("SELECT count(*) as count from company_setting")
    let info = row
    let infocount = countrow[0]
    res.render('hiro/hireohtml/HTML/browsecompanyfreelancer.ejs', { info: info, infocount: infocount, details: details })
    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/browse-companies.html'));
})
app.get('/single-company-profile/:company_id', async (req, res) => {

    const id = [req.params.company_id];
    if (!connection) {
        res.send('Error: Database connection is not established');
        return;
    }
    try {
        const [details] = await connection.execute(`SELECT * FROM company_setting WHERE company_id=(Select id from register_employer where status=1)`)

        const [rows] = await connection.execute(`SELECT * FROM company_setting WHERE company_id=${id}`);
        let info = rows[0]
        res.render('hiro/hireohtml/HTML/single-company-profile.ejs', { info: info, details: details })
    } catch (error) {
        console.error(error);
        res.send(error);
    }

    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/single-freelancer-profile.html'));
});
app.get('/single-company-profile/', async (req, res) => {
    const [id] = await connection.execute(`SELECT * FROM register_employer WHERE status=1`);
    if (!connection) {
        res.send('Error: Database connection is not established');
        return;
    }
    try {
        const [rows] = await connection.execute(`SELECT * FROM company_setting WHERE company_id=${id[0].id}`);
        let info = rows[0]
        const [details] = await connection.execute(`SELECT * FROM company_setting WHERE company_id=(Select id from register_employer where status=1)`)

        res.render('hiro/hireohtml/HTML/single-company-profile.ejs', { info: info, details: details })
    } catch (error) {
        console.error(error);
        res.send(error);
    }

    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/single-freelancer-profile.html'));
});
app.get('/companyprofile', async (req, res) => {

    const [company_id] = await connection.execute('SELECT * from register_employer where status=1');
    const id = company_id[0].id;
    if (!connection) {
        res.send('Error: Database connection is not established');
        return;
    }
    try {
        const [details] = await connection.execute(`SELECT * FROM company_setting WHERE company_id=(Select id from register_employer where status=1)`)

        const [rows] = await connection.execute(`SELECT * FROM company_setting WHERE company_id=${id}`);
        let info = rows[0]
        res.render('hiro/hireohtml/HTML/companyprofile.ejs', { info: info, details: details })
    } catch (error) {
        console.error(error);
        res.send(error);
    }

    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/single-freelancer-profile.html'));
});


app.get("/singlecompanypagefreelancer/:id", async (req, res) => {

    const id = [req.params.id];
    if (!connection) {
        res.send('Error: Database connection is not established');
        return;
    }
    try {
        const [details] = await connection.execute(`SELECT * FROM freelancer_profile WHERE id=(Select id from register_freelancer where status=1)`)

        const [rows] = await connection.execute(`SELECT * FROM company_setting WHERE company_id=${id}`);
        let info = rows[0]
        res.render('hiro/hireohtml/HTML/singlecompanypagefreelancer.ejs', { info: info, details: details })
    } catch (error) {
        console.error(error);
        res.send(error);
    }

})



app.post('/givecompanyreview', async (req, res) => {

    const id = req.body.id;
    const pass = req.body.rate;
    const pass2 = req.body.name;
    const pass3 = req.body.reviewtitle;
    const pass4 = req.body.message;
    console.log(id)

    //yaha per abhi company_id missing hai abhi jo
    const [freelancer_id] = await connection.execute('SELECT * from register_freelancer where status=1');
    const query = ('INSERT INTO review(company_id,freelancer_id,freename,reviewtitle,review,rate) VALUES (?,?,?,?,?,?)');
    await connection.execute(query, [id, freelancer_id[0].id, pass2, pass3, pass4, pass]);
    // const [details] = await connection.execute(`SELECT * FROM freelancer_profile WHERE id=(Select id from register_freelancer where status=1)`)

    res.redirect(`/singlecompanypagefreelancer/${id}`)
});
app.get('/dashboard-reviews', async (req, res) => {
    const [details] = await connection.execute(`SELECT * FROM freelancer_profile WHERE id=(Select id from register_freelancer where status=1)`)

    const query1 = 'SELECT * from register_freelancer where status=1';
    const [fd] = await connection.execute(query1);
    const fid = fd[0].id;
    const query2 = `SELECT * from review_freelancer where freelancer_id="${fid}"`;
    const [review] = await connection.execute(query2);
    const query4 = `SELECT * from company_setting`;
    const [company] = await connection.execute(query4);

    res.render('hiro/hireohtml/HTML/dashboard-reviews.ejs', { review: review, company: company, details: details });

    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/dashboard-reviews.html'));
});
app.get('/companyreviews', async (req, res) => {
    const [details] = await connection.execute(`SELECT * FROM company_setting WHERE company_id=(Select id from register_employer where status=1)`)

    const query1 = 'SELECT * from register_employer where status=1';
    const [cd] = await connection.execute(query1);
    const cid = cd[0].id;
    const query2 = `SELECT * from review where company_id="${cid}"`;
    const [review] = await connection.execute(query2);
    const query4 = `SELECT * from freelancer_profile`;
    const [freelancer] = await connection.execute(query4);

    res.render('hiro/hireohtml/HTML/companyreview.ejs', { review: review, freelancer: freelancer, details: details });

    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/companyreview.html'));
});


app.get('/single-freelancer-profile/', async (req, res) => {
    // const users = [req.params.id];

    const [row9] = await connection.execute(`select * from register_freelancer where status=1`)
    let users = row9[0].id
    if (!connection) {
        res.send('Error: Database connection is not established');
        return;
    }
    try {
        const [details] = await connection.execute(`SELECT * FROM freelancer_profile WHERE id=(Select id from register_freelancer where status=1)`)

        const [rows] = await connection.execute(`SELECT * FROM freelancer_profile WHERE id="${users}"`);
        const [row1] = await connection.execute(`SELECT * FROM job_applied join jobs ON job_applied.job_id=jobs.job_id AND freelance_id="${users}" JOIN company_setting where jobs.post_by=company_setting.company_id`)
        const [row2] = await connection.execute(`SELECT count(*) as count FROM job_applied WHERE freelance_id="${users}"`)
        const [row3] = await connection.execute(`SELECT * FROM review_freelancer WHERE freelancer_id="${users}"`)
        const [row4] = await connection.execute(`SELECT count(*) as count FROM review_freelancer WHERE freelancer_id="${users}"`)
        let info1 = row1
        let info = rows[0]
        let info2 = row2[0].count
        let info3 = row3
        let info4 = row4[0].count

        res.render('hiro/hireohtml/HTML/single-freelancer-profile.ejs', { info: info, info1: info1, info2: info2, info3: info3, info4: info4, details: details });
    } catch (error) {
        console.error(error);
        res.send(error);
    }
});
app.get('/single-freelancer-profile/:id', async (req, res) => {
    const users = [req.params.id];

    if (!connection) {
        res.send('Error: Database connection is not established');
        return;
    }
    try {
        const [details] = await connection.execute(`SELECT * FROM freelancer_profile WHERE id=(Select id from register_freelancer where status=1)`)

        const [rows] = await connection.execute(`SELECT * FROM freelancer_profile WHERE id="${users}"`);
        const [row1] = await connection.execute(`SELECT * FROM job_applied join jobs ON job_applied.job_id=jobs.job_id AND freelance_id="${users}" JOIN company_setting where jobs.post_by=company_setting.company_id`)
        const [row2] = await connection.execute(`SELECT count(*) as count FROM job_applied WHERE freelance_id="${users}"`)
        const [row3] = await connection.execute(`SELECT * FROM review_freelancer WHERE freelancer_id="${users}"`)
        const [row4] = await connection.execute(`SELECT count(*) as count FROM review_freelancer WHERE freelancer_id="${users}"`)
        let info1 = row1
        let info = rows[0]
        let info2 = row2[0].count
        let info3 = row3
        let info4 = row4[0].count
        res.render('hiro/hireohtml/HTML/single-freelancer-profile.ejs', { info: info, info1: info1, info2: info2, info3: info3, info4: info4, details: details });
    } catch (error) {
        console.error(error);
        res.send(error);
    }
});
app.post('/givefreelancerreview', async (req, res) => {
    const pass = req.body.rate;
    const pass2 = req.body.name;
    const pass3 = req.body.reviewtitle;
    const pass4 = req.body.message;
    const freelanceid = req.body.freelanceid
    console.log(freelanceid, pass, pass2, pass3, pass4)
    //yaha per abhi freelancer_id missing hai 
    const [company_id] = await connection.execute('SELECT * from register_employer where status=1');
    const query = ('INSERT INTO review_freelancer(company_id,freelancer_id,freename,reviewtitle,review,rate) VALUES (?,?,?,?,?,?)');
    await connection.execute(query, [company_id[0].id, freelanceid, pass2, pass3, pass4, pass]);
    res.redirect(`findfreelancerprofilecompany/${freelanceid}`)
});
app.post("/makeanoffer", async (req, res) => {
    const companyid = req.body.companyid
    const freelancerid = req.body.freelanceid

    const query = ('INSERT INTO job_offered_freelancer(company_id,freelance_id,status_job) VALUES (?,?,?)');
    await connection.execute(query, [companyid, freelancerid, "Pending"]);
    res.redirect(`findfreelancerprofilecompany/${freelancerid}`)
})
app.get('/findfreelancerprofilecompany/:id', async (req, res) => {

    const users = [req.params.id];
    if (!connection) {
        res.send('Error: Database connection is not established');
        return;
    }
    try {
        const [details] = await connection.execute(`SELECT * FROM company_setting WHERE company_id=(Select id from register_employer where status=1)`)

        const [rows] = await connection.execute(`SELECT * FROM freelancer_profile WHERE id="${users}"`);
        const [row1] = await connection.execute(`SELECT * FROM job_applied join jobs ON job_applied.job_id=jobs.job_id AND freelance_id="${users}" JOIN company_setting where jobs.post_by=company_setting.company_id`)
        const [row2] = await connection.execute(`SELECT count(*) as count FROM job_applied WHERE freelance_id="${users}"`)
        const [row3] = await connection.execute(`SELECT * FROM review_freelancer WHERE freelancer_id="${users}"`)
        const [row4] = await connection.execute(`SELECT count(*) as count FROM review_freelancer WHERE freelancer_id="${users}"`)
        const [row5] = await connection.execute("SELECT * from register_employer where status=1")
        let info1 = row1
        let info = rows[0]
        let info2 = row2[0].count
        let info3 = row3
        let info4 = row4[0].count
        let info5 = row5[0]
        const [rows6] = await connection.execute(`SELECT * FROM job_offered_freelancer WHERE freelance_id=${users} AND company_id=${info5.id}`)
        console.log(rows6[0])

        res.render('hiro/hireohtml/HTML/findfreelancerprofilecompany.ejs', { info: info, info1: info1, info2: info2, info3: info3, info4: info4, info5: info5, rows6: rows6, details: details });
    } catch (error) {
        console.error(error);
        res.send(error);
    }
})

// Handle the submission of the contact form
app.post("/contact", async (req, res) => {
    // Extract the form data from the request body
    const name = req.body.name;
    const email = req.body.email;
    const subject = req.body.subject;
    const comments = req.body.comments;
    console.log(name);

    // Send the message using the transporter object
    transporter.sendMail({
        from: email,
        to: "prolancerwebsite@gmail.com",
        subject: 'New message from contact form',
        text: `From: ${name} (${email}) Subject: ${subject}\n\n${comments}`
    }, (error, info) => {
        if (error) {
            console.log(error);
            res.send('An error occurred while sending the message.');
        } else {
            console.log(`Message sent: ${info.response}`);
            res.redirect("/pages-contact")
        }
    });
});
app.post("/applyforjob", async (req, res) => {
    const cv = req.files.upload_cv
    const jobid = req.body.jobid

    const uploadpathfile = __dirname + "/public/docs/" + cv.name
    const cvpath = "/docs/" + cv.name

    cv.mv(uploadpathfile, function (err) {
        if (err) return res.status(500).send(err)
        // else console.log("UPLOADEDDDDDDD")
    })

    const [row1] = await connection.execute(`select * from register_freelancer where status=1`)
    let info4 = row1[0]
    const [row2] = await connection.execute(`select * from freelancer_profile where id= ${info4.id}`)
    let info5 = row2[0]
    const query = `INSERT INTO job_applied (freelance_id,job_id,status_job,email,nam,cv) VALUES (?,?,?,?,?,?)`;
    // insert jobdetails apllied into the database
    console.log([info4.id, jobid, "pending", info5.email, info5.f_name + " " + info5.l_name, cvpath])
    await connection.execute(query, [info4.id, jobid, "pending", info5.email, info5.f_name + " " + info5.l_name, cvpath]);
    res.redirect(`/single-job-page/${jobid}`)
}
)
app.get('/single-job-page/:job_id', async (req, res) => {

    const users = [req.params.job_id];
    if (!connection) {
        res.send('Error: Database connection is not established');
        return;
    }
    try {
        const [rows] = await connection.execute(`SELECT * FROM jobs WHERE job_id="${users}"`);
        const [row1] = await connection.execute(`SELECT * FROM company_setting join jobs ON company_setting.company_id=jobs.post_by and job_id="${users}"`)
        const [sql] = await connection.execute(`SELECT * FROM job_applied WHERE freelance_id=(SELECT id from register_freelancer where status=1) AND job_id=${users}`)

        let info1 = row1[0]
        console.log(rows[0])
        let info = rows[0]
        const [details] = await connection.execute(`SELECT * FROM freelancer_profile WHERE id=(Select id from register_freelancer where status=1)`)

        res.render('hiro/hireohtml/HTML/single-job-page.ejs', { info: info, info1: info1, sql: sql, details: details });
    } catch (error) {
        console.error(error);
        res.send(error);
    }
});

app.get('/dashboard-manage-bidders/:proj_id', async (req, res) => {
    const proj_id = [req.params.proj_id];
    const [details] = await connection.execute(`SELECT * FROM company_setting WHERE company_id=(Select id from register_employer where status=1)`)

    const [row1] = await connection.execute(`SELECT * from bid join freelancer_profile on bid.freelancerid=freelancer_profile.id and bid.projectid="${proj_id}" and bid.status NOT LIKE "%Rejected%"`)

    let info1 = row1
    res.render('hiro/hireohtml/HTML/dashboard-manage-bidders.ejs', { info1: info1, details: details })
    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/termsofuse.html'));
});
app.get('/dashboard-manage-tasks', async (req, res) => {
    const [details] = await connection.execute(`SELECT * FROM company_setting WHERE company_id=(Select id from register_employer where status=1)`)

    const [rows] = await connection.execute(`SELECT * FROM post_task JOIN time_posted_duration_tasks
    ON time_posted_duration_tasks.id = post_task.proj_id
    WHERE proj_by = (SELECT id FROM register_employer WHERE status = 1)`)
    const [row1] = await connection.execute("SELECT avg(bid_rate) as avgbid,projectid,count(*) as count from bid group by projectid")
    let info1 = rows
    let info2 = row1


    res.render('hiro/hireohtml/HTML/dashboard-manage-tasks.ejs', { info1: info1, info2: info2, calculateDuration: calculateDuration, details: details })
    // res.sendFile(path.join(__dirname + '/views/hiro/hireohtml/HTML/termsofuse.html'));
});
app.get('/acceptbid/:bid_id', async (req, res) => {

    const bidid = req.params.bid_id
    await connection.execute(`UPDATE bid SET status="Accepted" WHERE bid_id=${bidid}`)
    const [proj] = await connection.execute(`SELECT * FROM bid WHERE bid_id=${bidid}`)
    res.redirect(`/dashboard-manage-bidders/${proj[0].projectid}`)
})
app.get('/rejectbid/:bid_id', async (req, res) => {
    const bidid = req.params.bid_id
    await connection.execute(`UPDATE bid SET status="Rejected" WHERE bid_id=${bidid}`)
    const [proj] = await connection.execute(`SELECT * FROM bid WHERE bid_id=${bidid}`)
    res.redirect(`/dashboard-manage-bidders/${proj[0].projectid}`)
})
app.get('/acceptpayment/:bid_id', async (req, res) => {

    const bidid = req.params.bid_id
    await connection.execute(`UPDATE bid SET status="Approved" WHERE bid_id=${bidid}`)
    const [proj] = await connection.execute(`SELECT * FROM bid WHERE bid_id=${bidid}`)
    res.redirect(`/dashboard-manage-bidders/${proj[0].projectid}`)
})
app.get('/submittask/:bid_id', async (req, res) => {
    const bidid = req.params.bid_id
    await connection.execute(`UPDATE bid SET status="Submitted" WHERE bid_id=${bidid}`)

    res.redirect(`/dashboard-my-active-bids`)
})
app.get('/resign/:id', async (req, res) => {
    const id = req.params.id
    await connection.execute(`UPDATE job_applied SET status="Resigned" WHERE id=${id}`)
    // const [job] = await connection.execute(`SELECT * FROM jobs WHERE job=${bidid}`)
    res.redirect(`/myactivebids`)
})
app.get('/acceptjob/:job_id', async (req, res) => {

    const jobid = req.params.job_id
    await connection.execute(`UPDATE job_applied SET status_job="Accepted" WHERE id=${jobid}`)
    const [proj] = await connection.execute(`SELECT * FROM job_applied WHERE id=${jobid}`)
    res.redirect(`/dashboard-manage-candidates/${proj[0].job_id}`)
})
app.get('/rejectjob/:job_id', async (req, res) => {
    const jobid = req.params.job_id
    await connection.execute(`UPDATE job_applied SET status_job="Rejected" WHERE id=${jobid}`)
    const [proj] = await connection.execute(`SELECT * FROM job_applied WHERE id=${jobid}`)
    res.redirect(`/dashboard-manage-candidates/${proj[0].job_id}`)
})
app.get('/interview/:id', async (req, res) => {
    const jobid = req.params.id
    await connection.execute(`UPDATE job_offered_freelancer SET status_job="Accepted" WHERE id=${jobid}`)
    // const [proj] = await connection.execute(`SELECT * FROM job_offered_freelancer WHERE id=${jobid}`)
    res.redirect(`/myactivejobs`)
})
app.get('/decline/:id', async (req, res) => {
    const jobid = req.params.id
    await connection.execute(`UPDATE job_offered_freelancer SET status_job="Rejected" WHERE id=${jobid}`)
    // const [proj] = await connection.execute(`SELECT * FROM job_offered_freelancer WHERE id=${jobid}`)
    res.redirect(`/myactivejobs`)
})
app.get('/removetask/:id', async (req, res) => {
    const taskid = req.params.id
    await connection.execute(`DELETE FROM time_posted_duration_tasks WHERE id=${taskid}`)

    await connection.execute(`DELETE FROM task_skills WHERE taskid=${taskid}`)

    await connection.execute(`DELETE FROM post_task WHERE proj_id=${taskid}`)
    // const [proj] = await connection.execute(`SELECT * FROM job_offered_freelancer WHERE id=${jobid}`)
    res.redirect(`/dashboard-manage-tasks`)
})
app.get('/removejob/:id', async (req, res) => {
    const jobid = req.params.id
    await connection.execute(`DELETE FROM time_posted_duration_jobs WHERE id=${jobid}`)

    await connection.execute(`DELETE FROM tag WHERE job_id=${jobid}`)

    await connection.execute(`DELETE FROM jobs WHERE job_id=${jobid}`)

    // const [proj] = await connection.execute(`SELECT * FROM job_offered_freelancer WHERE id=${jobid}`)
    res.redirect(`/dashboard-manage-jobs`)
})