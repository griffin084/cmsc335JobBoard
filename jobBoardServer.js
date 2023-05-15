// Dependencies
const fs = require("fs");
const path = require("path");
const express = require("express"); 
const bodyParser = require("body-parser");
const app = express();
const portNumber = process.argv[2];
const { MongoClient, ServerApiVersion } = require('mongodb');
require("dotenv").config({ path: path.resolve(__dirname, '.env') });

// Usage Check
if (process.argv.length != 3) {
  process.stdout.write(`Usage ${process.argv[1]} PORT_NUMBER_HERE\n`);
  process.exit(1);
}

// MongoDB credentials
const username = process.env.MONGO_DB_USERNAME;
const password = process.env.MONGO_DB_PASSWORD;
const database = process.env.MONGO_DB_NAME;
const boardCollection = process.env.MONGO_BOARD_COLLECTION;
const appCollection = process.env.MONGO_APP_COLLECTION;
const usersCollection = process.env.MONGO_USERS_COLLECTION;

// Initiate the server pages
app.set('view engine', 'ejs');

// Allowing the server to view CSS and image files
const publicDir = require('path').join(__dirname,'/public');
app.use(express.static(publicDir));

// Server is now listening on given port number
app.listen(portNumber);

// Intialize body parser
app.use(bodyParser.urlencoded({extended:false}));

//Mongo Setup
const uri = `mongodb+srv://${username}:${password}@cluster0.8bxycvi.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// Render the index page
app.get('/', (request, response) => {
  response.render('index');
});

// Render the about page
app.get('/about', (request, response) => {
    response.render('about');
});

// Render the admin login page
app.get('/login', (request, response) => {
    const action = {port: `http://localhost:${portNumber}/user`};
    response.render('login', action);
});

//from login we would check for admin or user 
//have a user page to look at their applications and a link to job board
//job board should have a filter to look through database and display listings
//admin page should have a form to add jobs (think of neccessary info) 

app.post('/user', async (request, response) => {
    const username = request.body.username;
    const password = request.body.password;

    if (username === 'admin' && password === '1234') {
      response.render('admin');
    } else if (username === '' && password === '') {
      const action = {port: `http://localhost:${portNumber}/register`};
      response.render('register', action)
    } else {
      //Check if the login provided was valid, if so display their user page
      await client.connect();
      const result = await client.db(database).collection(usersCollection).findOne({username: username});

      if (result !== null && result.password === password) {
        response.render("user");
      } else {
        response.render("invalid");
      }
    }
});

app.post('/register', async (request, response) => {
  const username = request.body.name;
  const password = request.body.passowrd;

  console.log(username + " " + password);

  try {
    await client.connect();
    //TODO: have to check if username has been taken before we register
    //as of now values being passed are null
    console.log(username + " " + password);
    let tempUser = {username: username, password: password};
    const result = await client.db(database).collection(usersCollection).insertOne(tempUser);

    //initially users variables will be empty but we might still need to pass something
    response.render("user");
  }
  catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
});

app.get('/addJobs', (request,response) => {
  const action = {port: `http://localhost:${portNumber}/addJobs`};
  response.render("addJobs", action);
});

app.post('/addJobs', async (request, response) => {
  const title = request.body.title;
  const salary = request.body.salary;
  const description = request.body.description;
  const requirements = request.body.requirements;

  try {
    await client.connect();
    let tempJob = {title: title, salary: salary, 
      description: description, requirements: requirements};
    const result = await client.db(database).collection(boardCollection).insertOne(tempJob);
    
    //initially users variables will be empty but we might still need to pass something
    response.render("board");
  }
  catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
});

app.get('removeJob', (request, response) => {
  const action = {port: `http://localhost:${portNumber}/removeJob`};
  response.render("removeJob", action);
});

app.post('removeJob', async (request, response) => {
  const title = request.body.title;
  const salary = request.body.salary;

  try {
    await client.connect();
    let targetJob = {title: title, salary: salary};
    const result = await client.db(database).collection(boardCollection).deleteOne(targetJob);
} catch (e) {
    console.error(e);
} finally {
    await client.close();
}
});

app.get('/board', (request, response) => {
  const action = {port: `http://localhost:${portNumber}/admin`};
  response.render('board', action);
});

/*Server Command Line Interpreter*/
process.stdin.setEncoding("utf8");
console.log(`Web server started and running at http://localhost:${portNumber}`);
const prompt = "Stop to shutdown the server: ";
process.stdout.write(prompt);
process.stdin.on("readable", function () {
  let dataInput = process.stdin.read();
  if (dataInput !== null) {
    let command = dataInput.trim();
    if (command === "stop") {
        console.log("Shutting down the server");
        process.exit(0);
    }
    process.stdout.write(prompt);
    process.stdin.resume();
  }
});