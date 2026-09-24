const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  location: {
    type: String,
    trim: true
  },
  profilePhoto: {
    type: String
  },
  skillsOffered: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    proficiency: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
      default: 'Intermediate'
    }
  }],
  skillsWanted: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium'
    }
  }],
  availability: {
    weekdays: {
      type: Boolean,
      default: false
    },
    weekends: {
      type: Boolean,
      default: false
    },
    evenings: {
      type: Boolean,
      default: false
    },
    mornings: {
      type: Boolean,
      default: false
    },
    customSchedule: {
      type: String,
      trim: true
    }
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  // New: Array of individual ratings (like commercial platforms)
  ratings: [{
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    swap: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Swap',
      required: true
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 500
    },
    date: {
      type: Date,
      default: Date.now
    },
    // Flagging fields for moderation
    flagged: {
      type: Boolean,
      default: false
    },
    flaggedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    flaggedReason: {
      type: String,
      trim: true
    },
    flaggedDate: {
      type: Date
    },
    // Helpfulness voting
    helpfulVotes: [{
      voter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      isHelpful: {
        type: Boolean,
        required: true
      },
      date: {
        type: Date,
        default: Date.now
      }
    }],
    helpfulCount: {
      type: Number,
      default: 0
    },
    notHelpfulCount: {
      type: Number,
      default: 0
    },
    // Review response
    response: {
      text: {
        type: String,
        trim: true,
        maxlength: 1000
      },
      date: {
        type: Date
      }
    },
    // Verification fields
    verified: {
      type: Boolean,
      default: false
    },
    verifiedSwapId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Swap'
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    verifiedDate: {
      type: Date
    }
  }],
  swapsCompleted: {
    type: Number,
    default: 0
  },
  bio: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile (without sensitive data)
userSchema.methods.getPublicProfile = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.email;
  return userObject;
};

// Add virtuals for average rating and count
userSchema.virtual('ratingAverage').get(function() {
  if (!this.ratings || this.ratings.length === 0) return 0;
  const sum = this.ratings.reduce((acc, r) => acc + r.rating, 0);
  return sum / this.ratings.length;
});

userSchema.virtual('ratingCount').get(function() {
  return this.ratings ? this.ratings.length : 0;
});

userSchema.set('toObject', { virtuals: true });
userSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('User', userSchema); 