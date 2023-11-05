const express = require('express')
const expressHandlebars = require('express-handlebars')
const Handlebars = require('handlebars')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const mongoose = require('mongoose')
const app = express()
const { userModel, postModel, addedPostModel, noteModel } = require('./dbSchemas')
const bcrypt = require('bcrypt')
const fs = require('fs')
const { extractor } = require('./fileFormatLogic')
const path = require('path')
const gtts = require('gtts')
const multer = require('multer')
require('dotenv').config()


// parser settings
const json_parser = bodyParser.json()
const urlencoded_parser =  bodyParser.urlencoded({
  extended: true,
})
// parser settings


// constants
const saltRounds = 8
const url = process.env.url
const port = process.env.port || 3000
// constants

// dependencies
app.use(cookieParser(process.env.cookieSecret))
app.use(json_parser)
app.use(urlencoded_parser)
app.use(express.static(__dirname + '/audio'))
// dependencies


// local storage settings
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, "uploads")
	},
	filename: (req, file, cb) => {
		cb(null, '1' + path.extname(file.originalname))
	}
})
const upload = multer({ storage: storage })
// local storage settings



// hbs
const hbs = expressHandlebars.create({
  defaultLayout: 'main',
  extname: 'hbs',
  helpers: {
	trimString: function(passedString, startstring, endstring) {
		let theString = passedString.substring( startstring, endstring );
		return new Handlebars.SafeString(theString)
	} // trims the string in case it's too long to be displayed
  }
})
app.engine('hbs', hbs.engine)
app.set('view engine', 'hbs')
app.set('views', 'views') // sets folder ( /views ) with pages
// hbs


// functions
const clearUp = (directory) => {
	fs.readdir(directory, (err, files) => {
		if (err) throw err;

		for (const file of files) {
			fs.unlink(path.join(directory, file), (err) => {
				if (err) throw err;
			});
		}
	}); // removes all the files from particular directory; 
		// needed in file handling (not to consume too much space on a disk)
}

const foundDbById = async (id) => {
	const findUserWithId = await userModel.find({ _id: id })
	if (!findUserWithId)
		return {}
	return findUserWithId
}

const foundSingleDocFromDb = async (postId) => {
	const findDoc = await postModel.find({ _id: postId })
	return findDoc
}

const foundDocsFromDbById = async (id) => {
	const findDocs = await addedPostModel.find({ userId: id })
	resListOfDocs = []
	findDocs.map(unitDoc => unitDoc.toJSON())
	for (const doc of findDocs) {
		let curId = doc.postId
		let arrToAdd = await foundSingleDocFromDb(curId)
		arrToAdd.map(docUnit => docUnit.toJSON())
		resListOfDocs.push(arrToAdd[0])
	}
	return resListOfDocs
}

const findFromAddedPostsById = async (userId, postId) => {
	// console.log(userId, postId)
	const findDocs = await addedPostModel.find({ userId: userId, postId: postId })
	// console.log(findDocs)
	if (findDocs[0])
		return true
	return false
}

const findAllNotesFromDb = async (userId, postId) => {
	const findNotes = await noteModel.find({ userId: userId, postId: postId })
	return findNotes
}
// functions



// middleware
const checkCookie = (req, res, next) => {
	if (!req.cookies.userId) {
		res.redirect('/')
		return 
	}
	const extractUserId = req.cookies.userId
	if (!foundDbById(extractUserId)) {
		res.redirect('/')
		return 
	}
	next()
}
// middleware


// get queries
app.get('/', (req, res) => {
    res.render('index', {
        title: 'home'
    })
})

app.get('/search', checkCookie, (req, res) => {
    res.render('search', {
        title: 'search',
        isSearch: true,
		user: foundDbById(req.cookies.userId)
    })
})

app.get('/register', async (req, res) => {
	const user = await foundDbById(req.cookies.userId)
	if (!user[0]) {
		res.render('register', {
			title: 'register'
		})
		return 
	}
	res.redirect('/auth')
})

app.get('/auth', async (req, res) => {
	const user = await foundDbById(req.cookies.userId)
	if (!user[0]) {
		res.render('auth', {
			title: 'auth'
		})
		return 
	}
	res.redirect('/my-docs')
})

app.get('/my-docs', checkCookie, async (req, res) => {
	const receivedData = await foundDocsFromDbById(req.cookies.userId)
	let finalData = []
	let c = 0
	for (const el of receivedData) {
		let isAdded = await findFromAddedPostsById(req.cookies.userId, el._id.toString())
		finalData.push(el.toJSON())
		finalData[c].isAdded = isAdded
		finalData[c].toSearch = false
		c += 1
	}
	res.render('docs', {
		title: 'my docs',
		isDocs: true,
		user: foundDbById(req.cookies.userId),
		docs: finalData,
		user: await foundDbById(req.cookies.userId)
	})
})

app.get('/add-docs', checkCookie, async (req, res) => {
	res.render('add-docs', {
		title: 'add docs',
		isAddDocs: true,
		user: await foundDbById(req.cookies.userId)
	})
})

app.get('/logout', (req, res) => {
	res.clearCookie('userId')
	res.redirect('/')
})

app.get('/remove-from-lib/:id', checkCookie, async (req, res) => {
	await addedPostModel.deleteOne({
		userId: req.cookies.userId,
		postId: req.params.id
	})
	res.redirect('/my-docs')
})

app.get('/add-to-lib/:id', checkCookie, async (req, res) => {
	const newAddedPost = new addedPostModel({
		userId: req.cookies.userId,
		postId: req.params.id
	})
	await newAddedPost.save()
	res.redirect('/my-docs')
})

app.get('/view/:id', checkCookie, async (req, res) => {
	// TODO view page
	// console.log(req.params.id)
	const booleanIf = await findFromAddedPostsById(req.cookies.userId, req.params.id)
	if (!booleanIf) {
		res.redirect('/')
		return 
	}
	let finalDoc = await foundSingleDocFromDb(req.params.id)
	let finalNotes = await findAllNotesFromDb(req.cookies.userId, req.params.id)
	// console.log(finalDoc)
	res.render('view', {
		title: 'view',
		docs: finalDoc.map(docUnit => docUnit.toJSON()),
		notes: finalNotes.map(noteUnit => noteUnit.toJSON()),
		user: await foundDbById(req.cookies.userId),
		postId: req.params.id
	})
})
// get queries


// post queries
app.post('/view/:id/add/', checkCookie, async (req, res) => {
	const newNoteByUser = new noteModel({
		userId: req.cookies.userId,
		postId: req.params.id,
		text: req.body.text
	})
	await newNoteByUser.save()
	res.redirect(`/view/${req.params.id}`)
})

app.post('/view/:id/delete/:noteId', checkCookie, async (req, res) => {
	await noteModel.deleteOne({ _id: req.params.noteId })
	res.redirect(`/view/${req.params.id}`)
})

app.post('/register', async (req, res) => {
	const data = req.body
	const findUserWithSameNickname = await userModel.find({ nickname: data.nickname })
	if (!data.password.length || !data.email.length || !data.nickname.length) {
		res.render('register', {
			error: "fill in all the forms!"
		})
	} else if (findUserWithSameNickname[0]) {
		res.render('register', {
			error: "user with such nickname already exists!"
		})
	} else {
		const hashedPassword = await bcrypt.hashSync(data.password, saltRounds)
		const newUser = new userModel({
			nickname: data.nickname,
			email: data.email,
			password: hashedPassword
		})
		await newUser.save()
		res.redirect('/auth')
	}
})

app.post('/auth', async (req, res) => {
	const data = req.body
	const findUserWithNickname = await userModel.find({ nickname: data.nickname })
	if (findUserWithNickname[0]) {
		const passFromDb = findUserWithNickname[0].password
		const passwordFromForm = data.password
		const verified = bcrypt.compareSync(passwordFromForm, passFromDb)
		if (verified) {
			// save cookie
			res.cookie('userId', findUserWithNickname[0]._id.toString(), {
				maxAge: 60 * 30 * 1000 // 30 mins
			})
			res.redirect('/search')
		} else {
			res.render('auth', {
				error: "incorrect password!"
			})
		}
	} else {
		res.render('auth', {
			error: "user with such nickname doesn't exist!"
		})
	}
})

app.post('/add-docs', checkCookie, upload.single('wordFile'), async (req, res) => {
	const file = fs.readdirSync('uploads')[0]
	const titleOfDoc = req.body.title
	const languageOfDoc = req.body.language
	if (!titleOfDoc.length) {
		res.render('add-docs', {
			title: 'add docs',
			isAddDocs: true,
			user: await foundDbById(req.cookies.userId),
			error: "choose the title of your document!"
		})
		return 
	}
	if (languageOfDoc == "undefined") {
		res.render('add-docs', {
			title: 'add docs',
			isAddDocs: true,
			user: await foundDbById(req.cookies.userId),
			error: "choose the language of your document!"
		})
		return 
	}
	const userNickname = await foundDbById(req.cookies.userId)
	if (file) {
		const extracted = extractor.extract('uploads/' + file.toString())
		extracted.then(async doc => {
			const extractedText = doc._body
			clearUp('uploads')
			let currentDate = new Date()
			const newPost = new postModel({
				authorId: req.cookies.userId,
				author: userNickname[0].nickname,
				date: currentDate.toLocaleDateString('EU').split('-').join(' '),
				language: languageOfDoc,
				addedByUsers: [req.cookies.userId],
				title: titleOfDoc,
				text: extractedText
			})
			await newPost.save()
			const searchedPost = await postModel.find({
				authorId: req.cookies.userId,
				author: userNickname[0].nickname,
				date: currentDate.toLocaleDateString('EU').split('-').join(' '),
				language: languageOfDoc,
				addedByUsers: [req.cookies.userId],
				title: titleOfDoc,
				text: extractedText
			})
			const getIdOfAddedPost = searchedPost[0]._id.toString()
			const newAddedPost = new addedPostModel({
				userId: req.cookies.userId,
				author: userNickname[0].nickname,
				postId: getIdOfAddedPost
			})
			await newAddedPost.save()
			const gttsEn = new gtts(extractedText, languageOfDoc);
			gttsEn.save(`${process.env.audioDirectory}/${getIdOfAddedPost}.mp3`, (err, result) => {
				if (err) console.log(err)
			})
			res.redirect('/search')
		})
	} else {
		const textOfDoc = req.body.text
		let currentDate = new Date()
		const newPost = new postModel({
			authorId: req.cookies.userId,
			author: userNickname[0].nickname,
			date: currentDate.toLocaleDateString('EU').split('-').join(' '),
			language: languageOfDoc,
			addedByUsers: [req.cookies.userId],
			title: titleOfDoc,
			text: textOfDoc
		})
		await newPost.save()
		const searchedPost = await postModel.find({
			authorId: req.cookies.userId,
			author: userNickname[0].nickname,
			date: currentDate.toLocaleDateString('EU').split('-').join(' '),
			language: languageOfDoc,
			addedByUsers: [req.cookies.userId],
			title: titleOfDoc,
			text: textOfDoc
		})
		const getIdOfAddedPost = searchedPost[0]._id.toString()
		const newAddedPost = new addedPostModel({
			userId: req.cookies.userId,
			author: userNickname[0].nickname,
			postId: getIdOfAddedPost
		})
		await newAddedPost.save()
		const gttsEn = new gtts(textOfDoc, languageOfDoc);
		gttsEn.save(`${process.env.audioDirectory}/${getIdOfAddedPost}.mp3`, (err, result) => {
			if (err) console.log(err)
		})
		res.redirect('/search')
	}
})

app.post('/search', checkCookie, async (req, res) => {
	const title = req.body.title
	const checkBox1 = req.body.checkBox1
	let receivedData
	const languageOfDoc = req.body.language
	if (languageOfDoc == "undefined") {
		res.render('search', {
			title: 'search',
			isSearch: true,
			user: await foundDbById(req.cookies.userId),
			error: "choose the preferred language!"
		})
		return 
	}
	if (checkBox1) {
		// search by author
		receivedData = await postModel.find({
			author: { "$regex": title, "$options": "i" },
			language: { "$regex": languageOfDoc, "$options": "i" }
		})
	} else {
		// search by title
		receivedData = await postModel.find({
			title: { "$regex": title, "$options": "i" },
			language: { "$regex": languageOfDoc, "$options": "i" }
		})
	}
	if (!receivedData.length) {
		res.render('search', {
			title: 'search',
			isSearch: true,
			user: await foundDbById(req.cookies.userId),
			error: "not found!"
		})
		return 	
	}
	// receivedData.map(dataUnit => dataUnit.toJSON())
	let finalData = []
	let c = 0
	for (const el of receivedData) {
		// console.log(req.cookies.userId, el._id.toString())
		let isAdded = await findFromAddedPostsById(req.cookies.userId, el._id.toString())
		finalData.push(el.toJSON())
		finalData[c].isAdded = isAdded
		finalData[c].toSearch = true
		c += 1
	}
	res.render('search', {
        title: 'search',
        isSearch: true,
		user: await foundDbById(req.cookies.userId),
		docs: finalData
    })
})
// post queries


start = async () => {
	try {
		await mongoose.connect(url)
			.then(console.log('db is connected!'))
			.catch(err => console.log(err))
		app.listen(port, () => {
			console.log(`Running on ${port}!`)
		})
  	} catch(e) {
    	console.log(e)
  	}
}

start()
