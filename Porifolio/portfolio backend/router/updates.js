const express = require('express');
const router = express.Router();
const { sendUpdateNotification } = require('../controller/update');
const Update = require('../models/Update');

router.post('/add-update', async (req, res) => {
    const { title, description } = req.body;

    try {
        const update = new Update({ title, description });
        await update.save();

        await sendUpdateNotification(title, description);

        res.status(200).json({ message: "Update posted and notifications sent!" });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;
