require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
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
const reservationsCollection = client.db('MHSdb').collection('reservations');
const paymentsCollection = client.db('MHSdb').collection('payments');

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();



    // jwt related api
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })

    // ?middlewares
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token bearer:', req.headers.authorization)
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
      const query = { _id: new ObjectId(id) };
      const result = await menuCollection.findOne(query);
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
        return res.send(result);
      }
      else {
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            name: menuItem.name,
            category: menuItem.category,
            price: menuItem.price,
            recipe: menuItem.recipe
          }
        }
        const result = await menuCollection.updateOne(filter, updatedDoc);
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

    app.get('/reviews/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await reviewsCollection.find(query).toArray();
      res.send(result);
    })

    app.put('/reviews', verifyToken, async (req, res) => {
      const review = req.body;
      const filter = { email: review.email };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          email: review.email,
          name: review.name,
          favouriteRecipe: review.favouriteRecipe,
          suggestion: review.suggestion,
          details: review.details,
          rating: review.rating
        }
      }
      const result = await reviewsCollection.updateOne(filter, updatedDoc, options);
      res.send(result);
    })

    // carts collection

    app.get('/carts', verifyToken, async (req, res) => {
      const query = { email: req.query.email };
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/carts', verifyToken, async (req, res) => {
      const cartItem = req.body;
      const result = await cartsCollection.insertOne(cartItem);
      res.send(result);
    })

    app.delete('/carts/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      console.log(id)
      const query = { _id: new ObjectId(id) };
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    })

    // reservation collection
    app.get('/reservation', async (req, res) => {
      const result = await reservationsCollection.find().toArray();
      res.send(result);
    })

    app.get('/reservation/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await reservationsCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/reservation', verifyToken, async (req, res) => {
      const data = req.body;
      console.log(data);
      const result = await reservationsCollection.insertOne(data);
      res.send(result);
    })

    app.delete('/reservation/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reservationsCollection.deleteOne(query);
      console.log(result)
      res.send(result);
    })

    // payment intent
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      if (!amount) {
        return;
      }
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      })

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    // payment related api
    app.get('/booking-payments', async (req, res) => {
      const result = await paymentsCollection.aggregate([
        {
          $match: {
            menuIds: false
          }
        }
      ]).toArray();
      res.send(result);
    })

    app.get('/payments/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      // if(email !== req.decoded.email){
      //   return res.status(403).send({message: 'forbidden'})
      // }
      const query = { email: email };
      const result = await paymentsCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/payments', verifyToken, async (req, res) => {
      const payment = req.body;
      console.log(payment);
      const paymentResult = await paymentsCollection.insertOne(payment);

      // carefully delete all items from the cart


      if (payment.category === 'Reservation') {
        const reservationQuery = {
          _id: {
            $in: payment.reservationIds?.map(id => new ObjectId(id))
          }
        }
        const deleteResult = await reservationsCollection.deleteMany(reservationQuery);
        return res.send({ paymentResult, deleteResult });
      }
      else {
        const cartQuery = {
          _id: {
            $in: payment.cartIds?.map(id => new ObjectId(id))
          }
        }
        const deleteResult = await cartsCollection.deleteMany(cartQuery);
        return res.send({ paymentResult, deleteResult });
      }
    })

    // stats or analytics
    app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
      const users = await usersCollection.estimatedDocumentCount();
      const products = await menuCollection.estimatedDocumentCount();
      const orders = await paymentsCollection.estimatedDocumentCount();

      // this is not the best way
      // const payments = await paymentsCollection.find().toArray();
      // const revenue = payments.reduce((total, payment) => total + parseFloat(payment.amount), 0)

      const result = await paymentsCollection.aggregate([
        {
          $group: {
            _id: null,
            revenue: { $sum: "$amount" }
          }
        }
      ]).toArray();

      const revenue = result.length > 0 ? result[0].revenue : 0;


      res.send({
        users,
        products,
        orders,
        revenue
      })
    })


    /**
     * ------------------------
     * Non efficient way
     * ------------------------
     * 
     * 1. load all the payments
     * 2. For every menuItemIds (which is an array) go find the item from menu collection
     * 3. for every item in the menu collection that you found from a payment entry (document)
    */

    // using aggregate pipeline
    app.get('/order-stats', verifyToken, verifyAdmin, async (req, res) => {
      const result = await paymentsCollection.aggregate([
        {
          $match: {
            menuIds: { $ne: false }
          }
        },
        {
          $unwind: '$menuIds'
        },
        {
          $addFields: {
            menuObjectId: { $toObjectId: '$menuIds' }
          }
        },
        {
          $lookup: {
            from: 'menu',
            localField: 'menuObjectId',
            foreignField: '_id',
            as: 'menuItem'
          }
        },
        {
          $unwind: '$menuItem'
        },
        {
          $group: {
            _id: '$menuItem.category',
            quantity: { $sum: 1 },
            revenue: { $sum: '$menuItem.price' }
          }
        },
        {
          $project: {
            _id: 0,
            category: '$_id',
            quantity: '$quantity',
            revenue: '$revenue'
          }
        }
      ]).toArray();
      res.send(result);
    })

    app.get('/single-user-data', verifyToken, async (req, res) => {
      const email = req.query.email;
      const result = await paymentsCollection.aggregate([
        {
          $match: { email: email }
        },
        {
          $group: {
            _id: null,
            wastedMoney: { $sum: '$amount' },
            totalOrder: { $sum: 1 },
            totalItem: {
              $sum: {
                $size: {
                  $cond: [
                    { $isArray: '$menuIds' },
                    '$menuIds',
                    []
                  ]
                }
              }
            }
          }
        }
      ]).toArray();
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