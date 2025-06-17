const mongoose = require('mongoose');

const TranslationSchema = new mongoose.Schema({
  requestId:   { type: String, required: true, unique: true },
  text:        { type: String, required: true },
  to:          { type: String, required: true }, // ex: 'pt', 'en'
  status:      { 
    type: String, 
    enum: ['queued','processing','completed','failed'], 
    default: 'queued' 
  },
  translatedText: { type: String },
  error:          { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Translation', TranslationSchema);
