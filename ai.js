var OpenAI = require('openai');
const fs = require('fs');
const child_process = require('child_process');

let openaiApiKey = child_process.execSync('secrets.sh openai-apikey', { encoding: 'utf8' }).trim();

// Models
//  gpt-4.1-nano  gives poor results
//  gpt-4.1-mini  gives better but still unacceptable results

async function main(userContent) {



    const openai = new OpenAI({ apiKey: openaiApiKey });

  const completion = await openai.chat.completions.create({
      //messages: [{ role: "system", content: "You are a crossword puzzle creator. Given a json of clues and solution pairs, adjust the json with a word count for the solutions." }],
      //messages: [{role: "user", content: userContent}],
      //{role: "user", content:   'Given the following crossword clue and its solution, return the integer wordcount of the solution by saying only the number\n  clue: domestic animals\nsolution: catsanddogs }'
      messages: [{role: "user", content: userContent }],
      model: "gpt-4.1",
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
