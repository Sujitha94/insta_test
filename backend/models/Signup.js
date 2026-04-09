const mongoose = require('mongoose');
const signupSchema = new mongoose.Schema({
  
  
    name: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String},
    phonenumber: {type:String},
    tenentId: { type: String, required: true},
    isAdmin: { type: Boolean, default: false },
    blocked: { type: Boolean, default: false },
    type:{ type: String},
    commentmoderation: { type: Boolean, default: false }
    
  }, { timestamps: true });
  const Signup = mongoose.model('Signup', signupSchema);
  module.exports = Signup;

