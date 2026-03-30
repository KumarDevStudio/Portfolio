const Subscriber = require('../models/Subscriber');
const { logger } = require('../utils/helpers');

// ─── POST /api/subscribe ─────────────────────────────────────
const subscribe = async (req, res) => {
  const { email } = req.body;

  if (!email || !email.trim()) {
    return res.status(400).json({ success: false, message: 'Email is required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
  }

  try {
    const existing = await Subscriber.findOne({ email: email.toLowerCase().trim() });

    if (existing) {
      return res.status(409).json({ success: false, message: 'This email is already subscribed.' });
    }

    const subscriber = await Subscriber.create({ email });

    logger.info(`New subscriber: ${subscriber.email}`);

    return res.status(201).json({
      success: true,
      message: 'Successfully subscribed!',
      data: { email: subscriber.email, subscribedAt: subscriber.createdAt },
    });
  } catch (err) {
    logger.error('Subscribe error:', err);
    return res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
};

// ─── GET /api/subscribers (admin use) ────────────────────────
const getAllSubscribers = async (req, res) => {
  try {
    const subscribers = await Subscriber.find({ isActive: true })
      .select('email createdAt')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: subscribers.length,
      data: subscribers,
    });
  } catch (err) {
    logger.error('Fetch subscribers error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── DELETE /api/unsubscribe ──────────────────────────────────
const unsubscribe = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required.' });
  }

  try {
    const subscriber = await Subscriber.findOneAndUpdate(
      { email: email.toLowerCase().trim() },
      { isActive: false },
      { new: true }
    );

    if (!subscriber) {
      return res.status(404).json({ success: false, message: 'Email not found.' });
    }

    return res.status(200).json({ success: true, message: 'Successfully unsubscribed.' });
  } catch (err) {
    logger.error('Unsubscribe error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { subscribe, getAllSubscribers, unsubscribe };