//import OpenAI from "openai";
var OpenAI = require('openai');
const fs = require('fs');

let f = fs.readFileSync('secret.json', 'utf8');
let secretJson = JSON.parse(f);
if (!secretJson['openai-apikey']) {
    throw new Error("No openai apikey");
}

async function main(userContent) {



    const openai = new OpenAI({ apiKey: secretJson['openai-apikey'] });

  const completion = await openai.chat.completions.create({
      //messages: [{ role: "system", content: "You are a crossword puzzle creator. Given a json of clues and solution pairs, adjust the json with a word count for the solutions." }],
      //messages: [{role: "user", content: userContent}],
      //{role: "user", content:   'Given the following crossword clue and its solution, return the integer wordcount of the solution by saying only the number\n  clue: domestic animals\nsolution: catsanddogs }'
      messages: [{role: "user", content: userContent }],
      model: "gpt-4o",
  });

  //console.log(completion.choices[0]);
    return completion.choices[0];
}

//main();

function ask(question) {
    return new Promise((resolve, reject) => {
        main(question).then((result) => {
            let response = result.message.content;
            resolve(response);
        });
    });
}

module.exports = {
    ask
};
