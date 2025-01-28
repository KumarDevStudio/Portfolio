const Subscription = require('../models/subscriptionModel');
const transporter = require('../config/nodemailerConfig');


exports.subscribe = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required.' });
    }

    try {
        const existingSubscription = await Subscription.findOne({ email });
        if (existingSubscription) {
            return res.status(400).json({ error: 'You are already subscribed.' });
        }

        const newSubscription = new Subscription({ email });
        await newSubscription.save();

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Subscription Confirmation',
            text: `Thank you for subscribing!`,
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: 'Subscription successful! Confirmation email sent.' });
    } catch (error) {
        console.error('Error subscribing:', error);
        res.status(500).json({ error: 'Failed to subscribe. Please try again.' });
    }
};
