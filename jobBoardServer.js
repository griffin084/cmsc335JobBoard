// Dependencies
const fs = require("fs");
const path = require("path");
const express = require("express"); 
const bodyParser = require("body-parser");
const app = express();
const portNumber = process.argv[2];
const { MongoClient, ServerApiVersion } = require('mongodb');
require("dotenv").config({ path: path.resolve(__dirname, '.env') });

// Usage Check (Depricated)
// if (process.argv.length != 3) {
//   process.stdout.write(`Usage ${process.argv[1]} PORT_NUMBER_HERE\n`);
//   process.exit(1);
// }

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
const uri = `mongodb+srv://${username}:${password}@cluster0.9115dex.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

// Render the index page
app.get('/', (request, response) => {
  response.render('index');
});

// Render the about page
app.get('/about', (request, response) => {
    response.render('about');
});

// Render the login page
app.get('/login', (request, response) => {
    const action = {port: `https://tricky-button-seal.cyclic.app/login`};
    response.render('login', action);
});

// Render the admin page
app.post('/login', async (request, response) => {
    const username = request.body.username;
    const password = request.body.password;

    if (username === 'admin' && password === '1234') {
      response.render('admin');
    } else {
      //Check if the login provided was valid, if so display their user page
      await client.connect();
      const result = await client.db(database).collection(usersCollection).findOne({username: username});

      if (result !== null && result.password === password) {
        const vars = {table: await getJobApps(username)};
        response.render('user', vars);
      } else {
        response.render("invalid");
      }
    }
});

app.get('/admin', (request, response) => {
  response.render('admin');
});

app.get('/register', (request, response) => {
  const action = {port: `https://tricky-button-seal.cyclic.app/register`, message: ""};
  response.render('register', action)
});

// Render the register page
app.post('/register', async (request, response) => {
  const username = request.body.username;
  const password = request.body.password;

  try {
    await client.connect();
    const check = await client.db(database)
                        .collection(usersCollection)
                        .findOne({username: username});

    if (check) {
      const action = {port: `https://tricky-button-seal.cyclic.app/register`, message: "Username is taken"};
      response.render('register', action);
    } else {
      let tempUser = {username: username, password: password};
      const result = await client.db(database).collection(usersCollection).insertOne(tempUser);

      const vars = {table: await getJobApps(username)};
        response.render('user', vars);
    } 
  }
  catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
});

// Render board page
app.get('/board', async (request, response) => {
  const vars = {table: await getTable()};
  response.render('board', vars);
});

// Render the application page
app.get('/apply', (request, response) => {
  const variables = {
    port: `https://tricky-button-seal.cyclic.app/applied`,
    position: request.query.position,
    company: request.query.company,
  };

  variables.company = variables.company.replace('-', ' ');
  variables.position = variables.position.replace('-', ' ');

  response.render('apply', variables);
});

// Render the applied page
app.post('/applied', async (request, response) => {
  const variables = {
    name: request.body.name,
    username: request.body.username,
    position: request.body.position,
    company: request.body.company,
    info: request.body.info
  };

  await addApplication(variables);

  response.render('applied', variables);
});

// Render the remove jobs page
app.get('/removeJobs', (request, response) => {
  const action = {port: `https://tricky-button-seal.cyclic.app/removeJobs`};
  response.render("removeJobs", action);
});

app.post('/removeJobs', async (request, response) => {
  const position = request.body.position;
  const company = request.body.company;

  try {
    await client.connect();
    let targetJob = {position: position, company: company};
    await client.db(database).collection(boardCollection).deleteOne(targetJob);
    await client.db(database).collection(appCollection).deleteMany(targetJob);

    const vars = {table: await getTable()};
    response.render('board', vars);
} catch (e) {
    console.error(e);
} finally {
    await client.close();
}
});

// Remove all applicants from the MongoDB database
app.get('/confirmAppsRemoved', async (request, response) => {
  let removed;
  let count = await removeApplicants();
  if (count) {
    removed = {removed: count};
  } else {
    removed = {removed: 0};
  }

  response.render('processAppsRemove', removed);
});

// Remove all job postings from the MongoDB database
app.get('/confirmJobsRemoved', async (request, response) => {
  let removed;
  let count = await removeJobs();
  if (count) {
    removed = {removed: count};
  } else {
    removed = {removed: 0};
  }

  response.render('processJobsRemove', removed);
});

// Render the page to add jobs to the board.
app.get('/addJobs', (request, response) => {
  const action = {port: `https://tricky-button-seal.cyclic.app/processAddJobs`};
  response.render('addJobs', action);
});

// Push data from job to MongoDB and post the process page
app.post('/processAddJobs', async (request, response) => {
  const variables = {
    position: request.body.position,
    company: request.body.company,
    startSalary: request.body.startingRange,
    endSalary: request.body.endingRange,
    location: request.body.location,
    description: request.body.description,
    requirements: request.body.requirements
  };

  await addJobs(variables);

  response.render('processAddJobs', variables);
});

// Render the list of applicants page
app.get('/viewApplicants', async (request, response) => {
  let table = '<table border=\"1\" id=\"app-table\"><tr><th>Name</th><th>Username</th><th>Position</th><th>Company</th><th>Info</th></tr>';
  let allApplicants;
  try {
    await client.connect();
    allApplicants = await client.db(database).collection(appCollection).find({}).toArray();
  } catch (e) {
    console.error(e)
  } finally {
    await client.close();
  }
  if (allApplicants && allApplicants.length !== 0) {
    allApplicants.forEach(element => {
      table += `<tr><td>${element.name}</td><td>${element.username}</td><td>${element.position}</td><td>${element.company}</td><td>${element.info}</td></tr>`
    });
    table += '</table>';
  
    const jobTable = {table: table};
  
    response.render('viewApplicants', jobTable);
  } else {
    const noApps = {table: '<div id="no-apps\">No Applicants</div>'};

    response.render('viewApplicants', noApps);
  }
});

// Function for adding application to MongoDB database
async function addApplication(values) {
  try {
    await client.connect();

    await client.db(database).collection(appCollection).insertOne(values);
  } catch (e) {
    console.error(e);
  } finally {
    await client.close();
  }
}

// Function for add jobs to MongoDB database
async function addJobs(values) {
  try {
      await client.connect();
      await client.db(database).collection(boardCollection).insertOne(values);
  } catch (e) {
      console.error(e);
  } finally {
      await client.close();
  }
}

async function getTable() {
  let table = '<table border=\"1\" id=\"job-table\"><tr><th>Position</th><th>Company</th><th>Salary Range</th><th>Location</th><th>Description</th><th>Requirements</th><th>Application</th></tr>';
  let allJobs;
  try {
    await client.connect();
    allJobs = await client.db(database).collection(boardCollection).find({}).toArray();
  } catch (e) {
    console.error(e)
  } finally {
    await client.close();
  }
  if (allJobs && allJobs.length !== 0) {
    allJobs.forEach(element => {
      table += `<tr><td>${element.position}</td><td>${element.company}</td><td>\$${element.startSalary}-\$${element.endSalary}`
      table += `</td><td>${element.location}</td><td>${element.description}</td><td>${element.requirements}</td>`
      table += `<td><a href=\"/apply/?position=${element.position.replace(' ', '-')}&company=${element.company.replace(' ', '-')}\"><button type=\"button\" class=\"admin-btns\">Apply</button></a></tr>`
    });
    table += '</table>';
  } else {
    table = '<div id="no-jobs\">There are no Jobs to Display</div>';
  }
  return table
}

async function getJobApps(username) {
  let table = '<table border=\"1\" id=\"job-table\"><tr><th>Position</th><th>Company</th><th>Salary Range</th><th>Location</th><th>Description</th><th>Requirements</th></tr>';
  let myJobs;
  try {
    await client.connect();
    let filter = {username: {$eq: username}};
    myJobs = await client.db(database).collection(appCollection).find(filter).toArray();

    if (myJobs && myJobs.length !== 0) {
      for (const element of myJobs) {
        let job = await client.db(database).collection(boardCollection).findOne({position: element.position, company: element.company});
        table += `<tr><td>${job.position}</td><td>${job.company}</td><td>\$${job.startSalary}-\$${job.endSalary}</td><td>${job.location}</td><td>${job.description}</td><td>${job.requirements}</td></tr>`
      };
      table += '</table><br>';
    } else {
      table = '<div id="no-jobs\">You have not applied to any jobs, or your applications have been rejected</div>';
    }
    table += '<a href=\"board\"><button type=\"button\" class=\"admin-btns\">Get yourself out there and apply!</button></a>';
    return table
  } catch (e) {
    console.error(e)
  } finally {
    await client.close();
  }
}

// Function for removing all applications from the MongoDB database
async function removeApplicants() {
  let result;
  try {
      await client.connect();
      result = await client.db(database).collection(appCollection).deleteMany({});
  } catch (e) {
      console.error(e);
  } finally {
      await client.close();
      return result.deletedCount;
  }
}

// Function for removing all applications from the MongoDB database
async function removeJobs() {
  let result;
  try {
      await client.connect();
      result = await client.db(database).collection(boardCollection).deleteMany({});
      await client.db(database).collection(appCollection).deleteMany({});
  } catch (e) {
      console.error(e);
  } finally {
      await client.close();
      return result.deletedCount;
  }
}

/*Server Command Line Interpreter (Depricated) */
// process.stdin.setEncoding("utf8");
// console.log(`Web server started and running athttps://tricky-button-seal.cyclic.app/`);
// const prompt = "Stop to shutdown the server: ";
// process.stdout.write(prompt);
// process.stdin.on("readable", function () {
//   let dataInput = process.stdin.read();
//   if (dataInput !== null) {
//     let command = dataInput.trim();
//     if (command === "stop") {
//         console.log("Shutting down the server");
//         process.exit(0);
//     }
//     process.stdout.write(prompt);
//     process.stdin.resume();
//   }
// });