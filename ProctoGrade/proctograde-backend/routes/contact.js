const express = require("express");
const ContactMessage = require("../models/ContactMessage");
const auth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");

const router = express.Router();

// Public GET/POST /api/contact are registered on the main app in server.js.
// This router only adds admin sub-routes under /api/contact/...

router.get("/messages", auth, requireAdmin, async (req, res) => {
  try {
    const messages = await ContactMessage.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return res.json(messages);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Could not load messages" });
  }
});

router.get("/messages/unread-count", auth, requireAdmin, async (req, res) => {
  try {
    const count = await ContactMessage.countDocuments({ read: false });
    return res.json({ count });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Could not count messages" });
  }
});

router.patch("/messages/mark-read", auth, requireAdmin, async (req, res) => {
  try {
    const { all, ids } = req.body || {};
    if (all) {
      await ContactMessage.updateMany({ read: false }, { $set: { read: true } });
      return res.json({ msg: "Marked all as read" });
    }
    if (Array.isArray(ids) && ids.length) {
      await ContactMessage.updateMany(
        { _id: { $in: ids } },
        { $set: { read: true } }
      );
      return res.json({ msg: "Marked as read" });
    }
    return res.status(400).json({ msg: "Provide { all: true } or { ids: [] }" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ msg: "Could not update messages" });
  }
});

module.exports = router;