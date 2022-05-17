const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fyytq.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const servicesCollection = client.db("doctors_portal").collection('services');
        const bookingsCollection = client.db("doctors_portal").collection('bookings');

        //    services.json er data newar jonno
        app.get('/service', async (req, res) => {
            const query = {};
            const cursor = servicesCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        });

        // API Naming Covention
        // app.get('/booking) -> get all bookings or more than one or by query
        // app.get('/booking/:id) -> get a specific booking
        // app.post('/booking) -> add a new booking
        // app.patch('/booking/:id') -> update specific
        // app.delete('/booking/:id') -> delete specific

        // Add a new booking:user j booking dicche setar information pabo
        
        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exists = await bookingsCollection.findOne(query);
            if (exists) {
              return res.send({ success: false, booking: exists })
            }
            const result = await bookingsCollection.insertOne(booking);
            return res.send({ success: true, result });
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
