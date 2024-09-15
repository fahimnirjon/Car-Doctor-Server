const express = require("express");
const cors = require("cors");
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
  origin: ['http://localhost:5174'],
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());

// middlewares

const loggers = async(req, res, next)=>{
  console.log('called' , req.host, req.originalUrl)
  next();
}

const verifyToken = async(req, res, next)=>{
  const token = req.cookies?.token;
  console.log('token value' , token)
  if(!token){
    return res.status(401).send({message: 'Not Authorized'})
  }
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded)=>{
    // if error
    if(err){
      console.log(err);
      return res.status(401).send({message : 'unauthorized'})
    }
    // if token is valid then decoded
    console.log('value in token', decoded);
    req.user = decoded;
    next();
  })
}

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.db6gj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const serviceCollection = client.db("carDoctor").collection("services");
    const bookingCollection = client.db("carDoctor").collection("bookings");

    // auth api
    app.post('/jwt',loggers,  async(req, res)=>{
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {expiresIn: '1h'})
      res
      .cookie('token', token, {
        httpOnly: true,
        secure: false
      })
      .send({success: true});
    })

    app.get("/services",loggers, async (req, res) => {
      const cursor = serviceCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const options = {
        projection: { title: 1, price: 1, service_id: 1, _id: 0, img: 1 },
      };
      const result = await serviceCollection.findOne(query, options);
      res.send(result);
    });

    // bookings

    app.get("/bookings",loggers, verifyToken, async (req, res) => {
      console.log(req.query.email);
      // console.log('token', req.cookies.token);
      if(req.query.email !== req.user.email){
        return res.status(403).send({message: 'forbidden access'})
      }
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    // update

    app.patch("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedBooking = req.body;
      const updatedDoc = {
        $set: {
          status: updatedBooking.status
        }
      };
      const result = await bookingCollection.updateOne(filter, updatedDoc)
      res.send(result);

      console.log(updatedBooking);
    });

    // delete

    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

app.get("/", (req, res) => {
  res.send("car doctor is running");
});

app.listen(port, () => {
  console.log(`Car Doctor server is running on port: ${port}`);
});

run().catch(console.dir);
