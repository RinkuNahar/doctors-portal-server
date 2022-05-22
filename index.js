const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fyytq.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

console.log(uri);

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
      if (err) {
        return res.status(403).send({ message: 'Forbidden access' })
      }
      req.decoded = decoded;
      next();
    });
  }

async function run() {
    try {
        await client.connect();
        const servicesCollection = client.db("doctors_portal").collection('services');
        const bookingsCollection = client.db("doctors_portal").collection('bookings');
        const userCollection = client.db("doctors_portal").collection('users');
        const doctorCollection = client.db("doctors_portal").collection('doctors');
        const paymentCollection = client.db('doctors_portal').collection('payments');

        const verifyAdmin = async(req, res, next) =>{
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({email: requester});
            if(requesterAccount.role === 'admin'){
                next();
            }
            else{
                res.status(403).send({message: 'forbidden'});
            }
        }

        // create payment 
        app.post('/create-payment-intent', verifyJWT, async(req, res) =>{
            const service = req.body;
            const price = service.price;
            const amount = price*100;
            const paymentIntent = await stripe.paymentIntents.create({
              amount : amount,
              currency: 'usd',
              payment_method_types:['card']
            });
            res.send({clientSecret: paymentIntent.client_secret})
          });

        //    services.json er data newar jonno
        app.get('/service', async (req, res) => {
            const query = {};
            const cursor = servicesCollection.find(query).project({name: 1});
            const services = await cursor.toArray();
            res.send(services);
        });

        // sb gulo user k pabe
        app.get('/user', verifyJWT, async(req,res)=>{
            const users = await userCollection.find().toArray();
            res.send(users);
        })

        // google dye sign in korle ageer thekei sign in kora chilo naki na seta janar jonno
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            //   JAWT Token
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN, { expiresIn: '1h' })
            res.send({ result, token });
        });

        // admin na hole all users dashboard er ta access i korte parbe na
        app.get('/admin/:email', async(req,res)=>{
            const email = req.params.email;
            const user = await userCollection.findOne({email: email});
            const isAdmin = user.role ==='admin';
            res.send({admin: isAdmin});
        })

        // user er email theke admin pabo
        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({email: requester});
            if(requesterAccount.role === 'admin'){
                const filter = { email: email };
                const updateDoc = {
                    $set: {role: 'admin'},
                };
                const result = await userCollection.updateOne(filter, updateDoc, );    
                res.send( result );
           
        }});


        // Find Available slot fro appointment
        app.get('/available', async (req, res) => {
            const date = req.query.date;

            // step 1:  get all services
            const services = await servicesCollection.find().toArray();

            // step 2: get the booking of that day. output: [{}, {}, {}, {}, {}, {}]
            const query = { date: date };
            const bookings = await bookingsCollection.find(query).toArray();

            // step 3: for each service
            services.forEach(service => {
                // step 4: find bookings for that service. output: [{}, {}, {}, {}]
                const serviceBookings = bookings.filter(book => book.treatment === service.name);
                // step 5: select slots for the service Bookings: ['', '', '', '']
                const bookedSlots = serviceBookings.map(book => book.slot);
                // step 6: select those slots that are not in bookedSlots
                const available = service.slots.filter(slot => !bookedSlots.includes(slot));
                //step 7: set available to slots to make it easier 
                service.slots = available;
            });


            res.send(services);
        })

        // API Naming Covention
        // app.get('/booking) -> get all bookings or more than one or by query
        // app.get('/booking/:id) -> get a specific booking
        // app.post('/booking) -> add a new booking
        // app.patch('/booking/:id') -> update specific
        // app.put('/booking/:id') -> upsert ==> update (if exists) or insert (if doesn't exist)
        // app.delete('/booking/:id') -> delete specific

        // dashboard e tar appointment gulo dekhte parbe user
        app.get('/booking', verifyJWT, async (req, res) => {
            const patient = req.query.patient;
            const decodedEmail = req.decoded.email;
            if (patient === decodedEmail) {
              const query = { patient: patient };
              const bookings = await bookingsCollection.find(query).toArray();
              return res.send(bookings);
            }
            else {
              return res.status(403).send({ message: 'forbidden access' });
            }
          
        });

        // payment er jonno 
        app.get('/booking/:id', verifyJWT, async(req, res)=>{
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const booking = await bookingsCollection.findOne(query);
            res.send(booking);
        });

        // Add a new booking:user j booking dicche setar information pabo
        app.post('/booking', async (req, res) => {
            const booking = req.body;
            // ekbar user ek date e ektai slot nite parbe
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exists = await bookingsCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists })
            }

            const result = await bookingsCollection.insertOne(booking);
            return res.send({ success: true, result });
        });

        // update payment
        app.patch('/booking/:id', verifyJWT, async(req, res) =>{
            const id  = req.params.id;
            const payment = req.body;
            const filter = {_id: ObjectId(id)};
            const updatedDoc = {
              $set: {
                paid: true,
                transactionId: payment.transactionId
              }
            }

            const result = await paymentCollection.insertOne(payment);
            const updatedBooking = await bookingsCollection.updateOne(filter, updatedDoc);
            res.send(updatedBooking);
          });

        // Manage doctors
        app.get('/doctor', verifyJWT, verifyAdmin, async(req,res)=>{
            const doctors = await doctorCollection.find().toArray();
            res.send(doctors);
        })

        app.post('/doctor', verifyJWT, verifyAdmin, async(req, res)=>{
            const doctor = req.body;
            const result = await doctorCollection.insertOne(doctor);
            res.send(result);
        });

        // delete doctor
        app.delete('/doctor/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = {email: email};
            const result = await doctorCollection.deleteOne(filter);
            res.send(result);
          });

    }

    finally {

    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hi');
});

app.listen(port, () => {
    console.log('Doctors Portal Is Running');
});
