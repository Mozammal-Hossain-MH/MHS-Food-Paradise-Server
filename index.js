const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.4zcowrs.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const usersCollection = client.db('MHSdb').collection('users');
const menuCollection = client.db('MHSdb').collection('menu');
const reviewsCollection = client.db('MHSdb').collection('reviews');
const cartsCollection = client.db('MHSdb').collection('carts');

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();



    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      console.log(user)
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })

    // ?middlewares
    const verifyToken = (req, res, next) => {
      console.log('inside verify token bearer:', req.headers.authorization)
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' })
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'unauthorized access' })
        }
        if (decoded) {
          req.decoded = decoded;
          next()
        }
      })
    }

    // use verify admin after verify token
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next();
    }


    // users collection
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result);
    })

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin' ? true : false;
        res.send({ admin });
      }
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      // insert email if user doesnt exist
      // you can do this in many ways (unique email, upsert, simple checking)
      const query = { email: req.body.email }
      const exist = await usersCollection.findOne(query);
      if (exist) {
        return res.send({
          message: 'user already exist',
          insertedId: null
        })
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc);
      res.send(result);
    })

    app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    })

    // menu collection
    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result);
    })

    app.get('/menu/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: id };
      const query2 = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);
      if (!result) {
        const result2 = await menuCollection.findOne(query2);
        return res.send(result2);
      }
      res.send(result);
    });

    app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
      const menuItem = req.body;
      const result = await menuCollection.insertOne(menuItem);
      res.send(result);
    })

    app.patch('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
      const menuItem = req.body
      const id = req.params.id;
      console.log(menuItem, id)
      if (menuItem.image) {
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            name: menuItem.name,
            category: menuItem.category,
            price: menuItem.price,
            recipe: menuItem.recipe,
            image: menuItem.image,
          }
        }
        const result = await menuCollection.updateOne(filter, updatedDoc);
        if (result.modifiedCount === 0) {
          const filter2 = { _id: id }
          const result2 = await menuCollection.updateOne(filter2, updatedDoc);
          return res.send(result2);
        }
        return res.send(result);
      }
      else {
        const filter = { _id: new ObjectId(id) };
        const filter2 = { _id: id };
        const updatedDoc = {
          $set: {
            name: menuItem.name,
            category: menuItem.category,
            price: menuItem.price,
            recipe: menuItem.recipe
          }
        }
        const result = await menuCollection.updateOne(filter, updatedDoc);
        if (result.modifiedCount === 0) {
          const result2 = await menuCollection.updateOne(filter2, updatedDoc);
          return res.send(result2);
        }
        return res.send(result);
      }
    })

    app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    })

    // reviews collection
    app.get('/reviews', async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    })

    // carts collection

    app.get('/carts',verifyToken, async (req, res) => {
      const query = { email: req.query.email };
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/carts', async (req, res) => {
      const cartItem = req.body;
      const result = await cartsCollection.insertOne(cartItem);
      res.send(result);
    })

    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      console.log(id)
      const query = { _id: new ObjectId(id) };
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', async (req, res) => {
  res.send({ message: 'MHS server is running' })
})

app.listen(port, () => {
  console.log(`server is running at port ${port}`)
})