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
        const userCollection = client.db("doctors_portal").collection('users');

        //    services.json er data newar jonno
        app.get('/service', async (req, res) => {
            const query = {};
            const cursor = servicesCollection.find(query);
            const services = await cursor.toArray();
            res.send(services);
        });

        // google dye sign in korle ageer thekei sign in kora chilo naki na seta janar jonno
        app.put('/user/:email', async(req,res)=>{
            const email = req.params.email;
            const user = req.body;
            const filter = {email: email};
            const options = {upsert : true};
            const updateDoc = {
                $set: user,
              };
              const result = await userCollection.updateOne(filter, updateDoc, options);
              res.send(result);
        });


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
        app.get('/booking', async (req, res) => {
            const patient = req.query.patient;
            const query = { patient: patient };
            const bookings = await bookingsCollection.find(query).toArray();
            res.send(bookings);
        })

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
