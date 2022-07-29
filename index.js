const express = require('express')
const app = express()
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const ObjectId = require('mongodb').ObjectId
const admin = require("firebase-admin");

//server port number
const port = process.env.PORT || 5000

//admin
const serviceAccount = require('./jerins-parlour-firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// middleware
app.use(cors())
app.use(express.json())

//mongodb connection 
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.v4fkr.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

//verifyToken
async function verifyToken(req, res, next) {
  if(req.headers.authorization?.startsWith('Bearer ')){
    const token = req.headers.authorization.split(' ')[1];

    try{
      const decodedUser = await admin.auth().verifyIdToken(token)
      req.decodedEmail = decodedUser.email;
    }
    catch{

    }
  }
  next();
}

async function run() {
   try {
     const database = client.db("jerins_parluor");
     const appointmentCollection = database.collection("appointment");
     const bookedAppointmentCollection = database.collection("booked");
     const reviewCollection = database.collection("review");
     const usersCollection = database.collection("users");

     app.get('/appointment', async (req, res) => {
      const cursor = appointmentCollection.find({})
      const result = await cursor.toArray()
      res.send(result)
     })

     app.get('/booked', async (req, res) => {
      const cursor = bookedAppointmentCollection.find({})
      const result = await cursor.toArray()
      res.send(result)
     })

     app.get('/review', async (req, res) => {
      const cursor = reviewCollection.find({})
      const result = await cursor.toArray()
      res.send(result)
     })

     app.get('/users', async (req, res) => {
      const cursor = usersCollection.find({})
      const result = await cursor.toArray()
      res.send(result)
     })

     app.get('/appointment/:id', async (req, res) => {
      const id = req.params.id;
      const cursor = {_id: ObjectId(id)}
      const result = await appointmentCollection.findOne(cursor)
      res.send(result)
     })

     app.get('/booked/:id', async (req, res) => {
      const id = req.params.id;
      const cursor = {_id: ObjectId(id)}
      const result = await bookedAppointmentCollection.findOne(cursor)
      res.send(result)
     })

     app.get('/bookedServices',verifyToken, async(req, res) => {
      const email = req.query.email;
      const filter = {email: email}
      const cursor = bookedAppointmentCollection.find(filter)
      const result = await cursor.toArray()
      res.json(result)
    })

    app.get('/users/:email', async(req, res) => {
      const email = req.params.email
      const filter = {email: email}
      const user = await usersCollection.findOne(filter)
      let isAdmin = false;
      if(user?.role === 'admin') {
        isAdmin = true;
      }
      res.json({admin: isAdmin})
    })

      // post the appointment
      app.post('/appointment', async(req, res) => {
        const cursor = req.body;
        const result = await appointmentCollection.insertOne(cursor);
        res.json(result);
      })

      // post the book appointment
      app.post('/booked', async(req, res) => {
        const cursor = req.body;
        const result = await bookedAppointmentCollection.insertOne(cursor);
        res.json(result);
      })

      // post the review
      app.post('/review', async(req, res) => {
        const cursor = req.body;
        const result = await reviewCollection.insertOne(cursor);
        res.json(result);
      })

      // post the users
      app.post('/users', async(req, res) => {
        const cursor = req.body;
        const result = await usersCollection.insertOne(cursor);
        res.json(result);
      })

      app.put('/users', async(req, res) => {
        const user = req.body;
        const filter = {email: user.email};
        const options = { upsert: true };
        const updateDoc = { 
          $set: user
        };
        const result = await usersCollection.updateOne(filter, updateDoc, options)
        res.json(result);
      })

      /* before verifyToken token
      app.put('/users/admin', async(req, res) => {
        const user = req.body;
        console.log('put',req.headers.authorization)
        const filter = { email: user.email };
        const options = { upsert: true };
        const updateDoc = { $set: {role: 'admin'}}
        const result = await usersCollection.updateOne(filter, updateDoc, options)
        res.json(result)
      })*/

      app.put('/users/admin', verifyToken, async(req, res) => {
        const user = req.body;
        const requester = req.decodedEmail;
        if(requester){
          const requesterAccount = await usersCollection.findOne({ email: requester});
          if(requesterAccount.role === 'admin'){
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: {role: 'admin'}}
            const result = await usersCollection.updateOne(filter, updateDoc, options)
            res.json(result)
          }
        }
        else{
          res.status(403).json({message: 'you do not have access to make admin'})
        }
      })

      app.put('/appointment/:id', async(req, res) => {
        const id = req.params.id;
        const body = req.body;
        const filter = {_id: ObjectId(id)}
        const options = { upsert: true }
        const updateDoc = {
          $set: {
            name: body.name,
            price: body.price,
            description: body.description
          }
        }
        const result = await appointmentCollection.updateOne(filter, updateDoc, options)
        res.json(result)
      })

      app.put('/booked/:id', async(req, res) => {
        const id = req.params.id;
        const filter = {_id: ObjectId(id)}
        const options = { upsert: true };
        const updateDoc = {
          $set: {
            paymentStatus: 'Done'
          },
        };
        const result = await bookedAppointmentCollection.updateOne(filter, updateDoc, options);
        res.json(result);
      })

      //delete appointment
      app.delete('/appointment/:id', async(req, res) => {
        const id = req.params.id;
        const cursor = {_id: ObjectId(id)}
        const result = await appointmentCollection.deleteOne(cursor);
        res.json(result);
      })

      //delete review
      app.delete('/review/:id', async (req, res) => {
        const id = req.params.id;
        const cursor = {_id: ObjectId(id)}
        const result = await reviewCollection.deleteOne(cursor)
        res.json(result);
      })
     
   } finally {
    //  await client.close();
   }
 }
run().catch(console.dir);

// server running
app.get('/', (req, res) => {
  res.send('Hello World!')
})

//listening port
app.listen(port, () => {
  console.log(`listening on port ${port}`)
})