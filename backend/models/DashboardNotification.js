const mongoose = require('mongoose');

const DashboardNotificationSchema = new mongoose.Schema({
    message: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

const DashboardNotification = mongoose.model('DashboardNotification', DashboardNotificationSchema);
module.exports = DashboardNotification;
