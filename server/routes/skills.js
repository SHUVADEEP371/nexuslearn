const express = require('express');
const User = require('../models/User');

const router = express.Router();

// Get popular skills
router.get('/popular', async (req, res) => {
  try {
    const users = await User.find({ isPublic: true });
    
    const skillCounts = {};
    
    users.forEach(user => {
      // Count skills offered
      user.skillsOffered.forEach(skill => {
        const skillName = skill.name.toLowerCase();
        if (!skillCounts[skillName]) {
          skillCounts[skillName] = { name: skill.name, offered: 0, wanted: 0 };
        }
        skillCounts[skillName].offered++;
      });
      
      // Count skills wanted
      user.skillsWanted.forEach(skill => {
        const skillName = skill.name.toLowerCase();
        if (!skillCounts[skillName]) {
          skillCounts[skillName] = { name: skill.name, offered: 0, wanted: 0 };
        }
        skillCounts[skillName].wanted++;
      });
    });
    
    // Convert to array and sort by total count
    const popularSkills = Object.values(skillCounts)
      .map(skill => ({
        ...skill,
        total: skill.offered + skill.wanted
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 20); // Top 20 skills
    
    res.json(popularSkills);
  } catch (error) {
    console.error('Get popular skills error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get skill suggestions based on search term
router.get('/suggestions', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json([]);
    }
    
    const users = await User.find({ isPublic: true });
    const suggestions = new Set();
    
    users.forEach(user => {
      user.skillsOffered.forEach(skill => {
        if (skill.name.toLowerCase().includes(q.toLowerCase())) {
          suggestions.add(skill.name);
        }
      });
      
      user.skillsWanted.forEach(skill => {
        if (skill.name.toLowerCase().includes(q.toLowerCase())) {
          suggestions.add(skill.name);
        }
      });
    });
    
    const suggestionsArray = Array.from(suggestions)
      .sort()
      .slice(0, 10); // Limit to 10 suggestions
    
    res.json(suggestionsArray);
  } catch (error) {
    console.error('Get skill suggestions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 