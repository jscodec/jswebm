const express = require('express');
const path = require('path');

const app = express();

app.use('/build', express.static(path.join(__dirname, '..', 'build')));
app.use('/matroska-test-files', express.static(path.join(__dirname, '..', 'matroska-test-files')));
app.use('/', express.static(path.join(__dirname)));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname + '/index.html'));
});

app.listen(8080);