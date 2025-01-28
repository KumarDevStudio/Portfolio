const transporter = require('../config/nodemailerConfig');
const Contact = require(`../models/contactRouter`);
const { validateEmail } = require('../utils/validators');

exports.sendContactMessage = async (req, res) => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    if (!validateEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format.' });
    }

    try {
        const newContact = new Contact({ name, email, message });
        await newContact.save();

        const mailOptions = {
            from: email,
            to: process.env.EMAIL_USER,
            subject: `New Contact Form Submission from ${name}`,
            text: `You have a new message:\n\nName: ${name}\nEmail: ${email}\nMessage: ${message}`,
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ message: 'Your message was sent successfully!' });
    } catch (error) {
        console.error('Error sending contact message:', error);
        res.status(500).json({ error: 'Failed to send your message. Please try again later.' });
    }
};
