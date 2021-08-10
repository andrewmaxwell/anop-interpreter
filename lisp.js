const prompt = require('prompt-sync')();
fs = require('fs');

/**
 * @param {String} text The users input
 * @returns Tokens to organize the AST
 */
const tokenize = (text) =>
  text.replaceAll(/^[\s]*\;.*\n?/gm, '')
    .split('"')
    .map((val, i) => i % 2 === 0 
      ? val.replace(/\(/g, ' ( ')
           .replace(/\)/g, ' ) ')
      : val.replace(/ /g, '-=whitespace=-')
    )
    .join('"')
    .trim() // get rid of trailing whitespace
    .split(/\s+/) // split on whitespace
    .map(val => val.replaceAll('-=whitespace=-', " "));

const makeNode = (token) => {
  if (!isNaN(parseFloat(token))) // if its a number
    return {type: "number", value: parseFloat(token)};
  else if (token[0] === '"') // if its a string
    return {type: "string", value: token.slice(1, token.length - 1)};
  else if ('+-*/%^<>&|'.split('').includes(token))
    return {type: "operator", value: token};
  else
    return {type: "id", value: token};
}

const parse = (tokens, ast=[]) => {
  const curTok = tokens.shift();  
  if (curTok === undefined) {
    return ast.pop(); // ends with extra array
  }
  else if (curTok === '(') {
    ast.push(parse(tokens, []));
    return parse(tokens, ast); // new subtree
  }
  else if (curTok === ')') {
    return ast; // end subtree
  }
  else { // must be and id or value
    return parse(tokens, ast.concat(makeNode(curTok)));
  }
}

const funcs = {
  print: x => console.log(x),
  head: x => x[0],
  tail: x => x.slice(1),
  range: x => [...Array(x[1] - x[0]).keys()].map(t => t + x[0])
};

const controlFlow = {
  if: (input, ctx) =>
    interpret(input[1], ctx)
    ? interpret(input[2], ctx)
    : interpret(input[3], ctx),

  var: (input, ctx) => {
    ctx.parent[input[1].value] = interpret(input[2], ctx);
    return interpret(input[2], ctx);
  },

  expr: (input, ctx) => {
    return (x) => {
      x = Object.values(Object(x)); //for some reason x is passed an object array??
      const exprCtx = ctx;
      for (let i = 0; i < input[1].length; ++i)
        exprCtx[input[1][i].value] = x[i];

      return interpret([input[2]], exprCtx);
    }
  }
}

const identify = (id, ctx) => {
  if (id in ctx) {
    return ctx[id];
  }
  else if (ctx.parent !== undefined) 
    return identify(id, ctx.parent);
  
  console.error(`Identifier "${id}" unknown`);
}

const interpret = (input=[], ctx = {scope: {}, parent: funcs}) => {
  if (Array.isArray(input)) {
    if (input.length > 0 && input[0].value in controlFlow) {
      return controlFlow[input[0].value](input, ctx);
    }
    else {
      input = input.map(t => interpret(t, {scope: {}, parent: ctx}));
      if (input[0] instanceof Function && input[0].name === 'op') {
        return input[0].apply(null, [input.slice(1)]);
      }
      else if (input[0] instanceof Function) {
        return input[0].apply(null, input.slice(1));
      }
      else
        return input;
    }
  }
  else if (input.type === 'id')
    return identify(input.value, ctx);
  else if (input.type === 'operator'){
    switch (input.value) {
      case '+': return op = x => x.reduce((a, b) => a + b);
      case '-': return op = x => x.reduce((a, b) => a - b);
      case '*': return op = x => x.reduce((a, b) => a * b);
      case '/': return op = x => x.reduce((a, b) => a / b);
      case '%': return op = x => x.reduce((a, b) => a % b);
      case '^': return op = x => x.reduce((a, b) => a ** b);
      case '<': return op = x => x.every((val, i) => val === x.sort()[i]);
      case '>': return op = x => x.every((val, i) => val === x.sort().reverse()[i]);
      case '&': return op = x => x.every(t => t);
      case '|': return op = x => x.some(t => t);
    }
  }
  else if (input.type === 'number' || input.type === 'string')
    return input.value;    
}

const main = () => {
  const flags = process.argv[2][0] === '-' ? process.argv[2] : undefined;
  let file;
  if (flags === undefined) file = process.argv[2];

  const input = flags.includes('c') 
    ? prompt('anop > ')
    : fs.readFileSync(file, { encoding: 'utf8', flag: 'r' });
  
  const tokens = tokenize(input);
  const ast = parse(tokens, []);

  if (flags !== undefined && flags.includes('d')) { // debug information
    console.log('Input:');
    console.log(input);
    
    console.log('Tokens:');
    console.log(tokenize(input));

    console.log('AST:');
    console.log(ast);
  }
  interpret(ast);
}

main();
