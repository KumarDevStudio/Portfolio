const nodemailer = require('nodemailer');
const Update = require('../models/Update');
const Subscriber = require('../models/subscriptionModel');

const sendUpdateNotification = async (title, description) => {
    try {
        const subscribers = await Subscriber.find({}, 'email'); // Fetch all subscriber emails
        const emailList = subscribers.map((subscriber) => subscriber.email);

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER, 
                pass: process.env.EMAIL_PASS, 
            },
        });

        const emailContent = `
            <h1>${title}</h1>
            <p>${description}</p>
        `;

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: emailList,
            subject: `New Update: ${title}`,
            html: emailContent, 
        };

        const BATCH_SIZE = 100; 
        for (let i = 0; i < emailList.length; i += BATCH_SIZE) {
            const batch = emailList.slice(i, i + BATCH_SIZE);
            mailOptions.to = batch;

            await transporter.sendMail(mailOptions);
            console.log(`Notifications sent to batch: ${batch}`);
        }

        console.log("All notifications sent successfully!");
    } catch (err) {
        console.error("Error sending notifications:", err);
        throw err;
    }
};

module.exports = { sendUpdateNotification };
