//load lib
require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const aws = require('aws-sdk')
const multer = require('multer')
const multerS3 = require('multer-s3')
const secureEnv = require('secure-env')
const cors = require('cors')
const morgan = require('morgan')
const Timestamp = require('mongodb').Timestamp
const fs = require('fs') //to delete file


const DATABASE_NAME = 'take-temp-tgt' //do not type out db/ collection names, use const instead
const COLLECTION = 'temperature'

//construct outside 'PORT' to minimise error
const mkTemperature = (params) => {
    return {
        ts: new Date(),
        user: params.userName,
        q1: params.q1,
        q2: params.q2,
        temperature: params.temperature
    }
}

//import MongoDb driver
const MongoClient = require('mongodb').MongoClient

//connection string
const MONGO_URL = 'mongodb://localhost:27017'

//create a client pool
const mongoClient = new MongoClient(MONGO_URL,
    { useNewUrlParser: true, useUnifiedTopology: true }
)

//configure PORT
const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3000

//config s3 port and digitaloceanspaces
const APP_PORT = process.env.APP_PORT
const AWS_S3_HOSTNAME = process.env.AWS_S3_HOSTNAME;
const AWS_S3_ACCESSKEY_ID = process.env.AWS_S3_ACCESSKEY_ID;
const AWS_S3_SECRET_ACCESSKEY = process.env.AWS_S3_SECRET_ACCESSKEY;
const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

//setup access and secret access keys
const endpoint = new aws.Endpoint('sfo2.digitaloceanspaces.com')
const s3 = new aws.S3({
    endpoint: endpoint,
    accessKeyId: AWS_S3_ACCESSKEY_ID,
    secretAccessKey: AWS_S3_SECRET_ACCESSKEY
})


const upload = multer({
    //dest: process.env.TMP_DIR || './uploads' //place in temp folder
    storage: multerS3({
        s3: s3,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public read',
        metadata: function (req, file, cb) {
            cb(null, {
                filename: file.filename,
                orignialFileName: file.originalname,
                 
            })
        },
        key: function (request, file, cb) {
            console.log(file)
            cb(null, file.originalname)
        },
        limits: { fileSize: 2000000 },
    })
})

//initiate express
const app = express()

//initiate dependencies
app.use(cors());
app.use(morgan('combined'))



// POST /temperature
//app.post('/temperature'), express.json(), (req, res) => {
app.post('/temperature', upload.single('temp-img'), (req, res) => {

    //req.body.userName, 
    //req.body.q1, req.body.q2, 
    //req.body.temperature
    const doc = mkTemperature(req.body)

    res.on('finish', () => {
        //delete the temp file
        fs.unlink(req.file.path, () => { })
        //console.info('>>> response ended')
    })
    console.info('>>> req.body: ', req.body)
    console.info('>>> req.file: ', req.file)

    res.status(200)
    res.json({})

    // TODO: insert doc into mongo
    
    mongoClient.db(DATABASE_NAME)
    .collection(COLLECTION)
    .insertOne(doc)
    .then(result => {
        console.info('insert result: ', results)
        res.status(200)
       // res.type('application/json')
        res.json({})
    }).catch(error => {
        console.info('insert error: ', error)
        res.status(500)
        res.json({error})
    })


    res.status(200)
    res.type('application/json')
    res.json({})

})

//keys must be available and must connect mongodb before startin app
//construct a promise
const p0 = new Promise(
    (resolve, reject) => {
        if ((!!process.env.AWS_S3_ACCESSKEY_ID) && (!!process.env.AWS_S3_SECRET_ACCESSKEY)) {
            resolve()
        } else {
            reject('S3 keys not found')
        }
    }

)
const p1 = mongoClient.connect()
//start server
Promise.all([[p0, p1]])
    .then(() => {
        app.listen(PORT, () => {
            console.info(`Application started on ${PORT} at ${new Date()}`)
        })
    }).catch(e => {
        console.error('Unable to connect to DB')
    }) 
