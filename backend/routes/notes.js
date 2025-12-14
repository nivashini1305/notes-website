const express = require('express');
const { Note, User } = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Get all notes for authenticated user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', tags = '' } = req.query;

        // Build search query
        let query = { author: req.userId };

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } }
            ];
        }

        if (tags) {
            const tagArray = tags.split(',').map(tag => tag.trim());
            query.tags = { $in: tagArray };
        }

        const notes = await Note.find(query)
            .populate('author', 'username')
            .sort({ updatedAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Note.countDocuments(query);

        res.json({
            notes,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });

    } catch (error) {
        console.error('Get notes error:', error);
        res.status(500).json({ message: 'Server error fetching notes' });
    }
});

// Get single note by ID
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const note = await Note.findOne({
            _id: req.params.id,
            $or: [
                { author: req.userId },
                { isPublic: true }
            ]
        }).populate('author', 'username');

        if (!note) {
            return res.status(404).json({ message: 'Note not found' });
        }

        res.json({ note });

    } catch (error) {
        console.error('Get note error:', error);
        res.status(500).json({ message: 'Server error fetching note' });
    }
});

// Create new note
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { title, content, tags = [], isPublic = false } = req.body;

        // Validation
        if (!title || !content) {
            return res.status(400).json({
                message: 'Title and content are required'
            });
        }

        if (title.length > 100) {
            return res.status(400).json({
                message: 'Title must be 100 characters or less'
            });
        }

        if (content.length > 5000) {
            return res.status(400).json({
                message: 'Content must be 5000 characters or less'
            });
        }

        // Create new note
        const note = new Note({
            title: title.trim(),
            content: content.trim(),
            author: req.userId,
            tags: Array.isArray(tags) ? tags.map(tag => tag.trim()) : [],
            isPublic
        });

        await note.save();
        await note.populate('author', 'username');

        res.status(201).json({
            message: 'Note created successfully',
            note
        });

    } catch (error) {
        console.error('Create note error:', error);
        res.status(500).json({ message: 'Server error creating note' });
    }
});

// Update note
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { title, content, tags, isPublic } = req.body;

        // Find note and verify ownership
        const note = await Note.findOne({
            _id: req.params.id,
            author: req.userId
        });

        if (!note) {
            return res.status(404).json({
                message: 'Note not found or you do not have permission to edit it'
            });
        }

        // Validation
        if (title && title.length > 100) {
            return res.status(400).json({
                message: 'Title must be 100 characters or less'
            });
        }

        if (content && content.length > 5000) {
            return res.status(400).json({
                message: 'Content must be 5000 characters or less'
            });
        }

        // Update fields
        if (title !== undefined) note.title = title.trim();
        if (content !== undefined) note.content = content.trim();
        if (tags !== undefined) note.tags = Array.isArray(tags) ? tags.map(tag => tag.trim()) : [];
        if (isPublic !== undefined) note.isPublic = isPublic;

        await note.save();
        await note.populate('author', 'username');

        res.json({
            message: 'Note updated successfully',
            note
        });

    } catch (error) {
        console.error('Update note error:', error);
        res.status(500).json({ message: 'Server error updating note' });
    }
});

// Delete note
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const note = await Note.findOneAndDelete({
            _id: req.params.id,
            author: req.userId
        });

        if (!note) {
            return res.status(404).json({
                message: 'Note not found or you do not have permission to delete it'
            });
        }

        res.json({ message: 'Note deleted successfully' });

    } catch (error) {
        console.error('Delete note error:', error);
        res.status(500).json({ message: 'Server error deleting note' });
    }
});

// Get public notes
router.get('/public/all', async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;

        let query = { isPublic: true };

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } }
            ];
        }

        const notes = await Note.find(query)
            .populate('author', 'username')
            .sort({ updatedAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Note.countDocuments(query);

        res.json({
            notes,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });

    } catch (error) {
        console.error('Get public notes error:', error);
        res.status(500).json({ message: 'Server error fetching public notes' });
    }
});

module.exports = router;