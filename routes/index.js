var express = require('express');
var router = express.Router();

const userModel = require('./users');
const postModel = require('./post');
const passport = require('passport');
const localStrategy = require('passport-local');
const upload = require('./multer');

passport.use(new localStrategy(userModel.authenticate()));

// Helper function to format date for display
const formatDateForDisplay = (date) => {
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(date).toLocaleDateString('en-US', options);
};

router.get('/', function(req, res) {
  res.render('index', {footer: false});
});

router.get('/login', function(req, res) {
  res.render('login', {footer: false});
});

router.get('/profile',isLoggedIn, async function(req, res) {
  const user = await userModel.findOne({username: req.session.passport.user}).populate("posts");
  res.render('profile', {footer: true, user: user});
});

router.get('/search', isLoggedIn, async function(req, res) {
  const user = await userModel.findOne({username: req.session.passport.user});
  res.render('search', {footer: true, user});
});

router.get('/edit', isLoggedIn, async function(req, res) {
  const user = await userModel.findOne({username: req.session.passport.user});
  res.render('edit', {footer: true, user });
});

router.get('/upload', isLoggedIn, async function(req, res) {
  const user = await userModel.findOne({username: req.session.passport.user});
  res.render('upload', {footer: true, user});
});

router.get('/feed', isLoggedIn, async function(req, res) {
  const user = await userModel.findOne({username: req.session.passport.user});
  const posts = await postModel.find().populate("user");

  // Format the date for each post
  const formattedPosts = posts.map(post => {
    const formattedDate = formatDateForDisplay(post.date);
    const user = post.user[0]; // Assuming user is an array, take the first element
    const username = user ? user.username : ''; // Default to an empty string if user is not defined
    const profileImage = user ? user.profileImage : ''; // Default to an empty string if user is not defined
  
    return {
      ...post._doc,
      formattedDate,
      user: {
        username,
        profileImage
      }
    };
  });

   res.render("feed", {footer: true, user, posts: formattedPosts});
});

// Like post and remove like post
router.get('/like/post/:id', isLoggedIn, async function(req, res) {
  const user = await userModel.findOne({username: req.session.passport.user});
  const post = await postModel.findOne({_id: req.params.id});
  
  // if already like, remove like
  // if not liked, like it
  if(post.likes.indexOf(user._id) == -1){
    post.likes.push(user._id);
  }
  else{
    post.likes.splice(post.likes.indexOf(user._id), 1);
  }
  await post.save();
  res.redirect("/feed");
});

// search user at search page
router.get("/username/:username", isLoggedIn, async function(req, res) {
  const regex = new RegExp(`^${req.params.username}`,'i');
  const users = await userModel.find({username: regex});
  res.json(users);
});

// Register of an account
router.post('/register', function(req, res, next){
  const userData = new userModel({
    username: req.body.username,
    name: req.body.name,
    email: req.body.email
  });

  userModel.register(userData, req.body.password)
  .then(function(){
    passport.authenticate("local")(req, res, function(){
      res.redirect('/profile');
    })
  })
});

// Login user
router.post('/login', passport.authenticate("local", {
  successRedirect: '/profile',
  failureRedirect: "/login"
}), function(req, res) {
});

// Logout User
router.get('/logout', function(req, res, next){
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/login');
  });
});

// Updating dp, username, name, bio
router.post("/update", upload.single('image'), async function(req, res){
  const user = await userModel.findOneAndUpdate(
    {username: req.session.passport.user},
    {username: req.body.username, name: req.body.name, bio: req.body.bio},
    {new: true}
  );

  if(req.file){
    user.profileImage = req.file.filename;
  }
  await user.save();
  res.redirect('/profile');
});

// Uploading posts
router.post("/upload", isLoggedIn, upload.single("image"), async function(req, res){
  const user = await userModel.findOne({username: req.session.passport.user});
  const post = await postModel.create({
    picture: req.file.filename,
    user: user._id,
    caption: req.body.caption
  })
  user.posts.push(post._id);
  await user.save();
  res.redirect("/feed");
});

//Function for protecting routes
function isLoggedIn(req, res, next) {
  if(req.isAuthenticated()) return next();
  res.redirect('/login');
};

module.exports = router;
