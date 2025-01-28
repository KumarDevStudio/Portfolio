const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();
const contactRouter = require('./router/contactRouter');
const subscriptionRoutes = require('./router/subscriptionRoutes');
const updateRoutes = require('./router/updates');

const app = express();
const PORT = process.env.PORT || 5000;


const corsOptions = {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
};
app.use(cors(corsOptions));
app.use(express.json());


app.use('/api', contactRouter);
app.use('/api', subscriptionRoutes);
app.use('/api', updateRoutes);



mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('MongoDB connected'))
    .catch((error) => console.error('MongoDB connection error:', error));


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});


