const { Schema, model } = require('mongoose')

const userSchema = new Schema({
    nickname: String,
    email: String,
    password: String
})
const userModel = model('users', userSchema)

const postSchema = new Schema({
    authorId: String,
    author: String,
    date: String,
    language: String,
    addedByUsers: [
        { type: String }
    ],
    title: String,
    text: String
})
const postModel = model('posts', postSchema)

const addedPostChema = new Schema({
    userId: String,
    author: String,
    postId: String
})
const addedPostModel = model('addedPosts', addedPostChema)

const noteSchema = new Schema({
    userId: String,
    postId: String,
    text: String
})
const noteModel = model('notes', noteSchema)

module.exports = { userModel, postModel, addedPostModel, noteModel }