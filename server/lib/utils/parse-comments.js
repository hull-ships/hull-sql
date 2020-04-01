// @flow

/**
 * Searches for variables in a sql comment, defined by a regex
 * @param sqlComment as the commented section in a sql query
 * @param replacements as the known values to ignore
 * @param client as the Hull client for logging
 */
function parseForVariable(sqlComment: string, replacements: Object, client: Object) {
  return sqlComment.replace(/\:+(?!\d)(\w+)/g, (value, key) => {
    if (!replacements[key]) {
      client.logger.debug("Detected variable(s) in comment section of query", key);
      throw new Error(`Unsupported variable in comment section -> ${key}`);
    }
  });
  // if (!replacements || Object.keys(replacements).length === 0) {
  //   return;
  // }
  // const match = sqlComment.match(/\:+(?!\d)(\w+)/g);
  // if (match) {
  //   match.forEach(m => {
  //     if (!replacements[m]) {
  //       client.logger.debug("Detected variable(s) in comment section of query", m);
  //       throw new Error(`Unsupported variable in comment section -> ${m}`);
  //     }
  //   });
  // }
}

/**
 * Detects whether or not the current index of a string shows a beginning of a comment block such as "/*"
 * @param request as the string to parse
 * @param index as the cursor to look at in the request
 * @returns true when a comment block starts, false otherwise
 */
function isStartOfCommentBlock(request: string, index: number): boolean {
  return index >= 0 && index + 1 < request.length &&
    request[index] === "/" && request[index + 1] === "*";
}

/**
 * Detects whether or not the current index of a string shows an ending of a comment block such as "* /"
 * @param request as the string to parse
 * @param index as the cursor to look at in the request
 * @returns true when a comment block starts, false otherwise
 */
function isEndOfCommentBlock(request: string, index: number): boolean {
  return index >= 0 && index + 1 < request.length &&
    request[index] === "*" && request[index + 1] === "/";
}

/*
 * Detects whether or not the current index of a string shows a beginning of a comment line such as "--"
 * @param request as the string to parse
 * @param index as the cursor to look at in the request
 * @returns true when a comment line is detected, false otherwise
 */
function isStartOfCommentLine(request: string, index: number): boolean {
  return index >= 0 && index + 1 < request.length &&
      request[index] === "-" && request[index + 1] === "-";
}

/**
 * Finds the end of a line comment in a string succeeding a given index
 * @param request as the string to edit
 * @param index as the cursor to start removing characters
 * @returns {number} as index of the end of the line
 */
function findEndOfLine(request: string, index: number): number {
  let end = index;
  while (end >= 0 && end < request.length && request[end] !== "\r" && request[end] !== "\n") {
    end += 1;
  }
  return end;
}

/**
 * Finds the end of comment block in a string succeeding a given index.
 * It follows the following logic: For every opened nested comment, a closing block sequence is expected.
 * If not, the function will throw.
 * @param request
 * @param index
 * @param replacements as the known values to ignore
 * @param client as the Hull client for logging
 * @returns {number}
 * @throws Error saying that an invalid comment block was detected
 */
function findEndOfBlock(request: string, index: number, replacements: Object, client: Object): number {
  let end = index + 2;
  let counter = 1;
  while (end < request.length && counter > 0) {
    if (isStartOfCommentBlock(request, end)) {
      counter += 1;
      end += 2;
    } else if (isEndOfCommentBlock(request, end)) {
      counter -= 1;
      end += 2;
    } else {
      end += 1;
    }
  }
  if (end >= request.length && counter > 0) {
    // Invalid comment block - not properly terminated.
    throw new Error("Invalid comment block");
  }
  return end;
}

/* test /* */
// The comment block above isn't correct inside the SQL editor
// When parsing through the sql request, do as follow when you meet the set of character:
// '      => look for closing pair and ignore everything between
// "      => look for closing pair and ignore everything between
// --     => look for end of line and remove everything between
// /*     => start looking for end of comment block
//            To do so, count every time you read a /* by increasing a counter
//            When you read */ decrease the counter
//            When it goes down to zero, you met the end of that block

/**
 * Looks for the two different types of comment in SQL and attempt to remove them if the option is enabled
 * @param request as the string to manipulate
 * @param replacements as the known values to ignore
 * @param client as the Hull client for logging
 * @returns {string} as the newly formatted request
 */
export default (request: string, replacements: Object, client: Object) => {
  const deleteComments = process.env.DELETE_COMMENTS || false;
  let i = 0;
  while (i < request.length) {
    if (isStartOfCommentLine(request, i)) {
      const endOfLine = findEndOfLine(request, i);
      if (deleteComments) {
        request = request.substring(0, i) + request.substring(endOfLine, request.length);
      } else {
        parseForVariable(request.substring(i, endOfLine), replacements, client);
        i = endOfLine;
      }
    } else if (isStartOfCommentBlock(request, i)) {
      const endOfBlock = findEndOfBlock(request, i);
      if (deleteComments) {
        request = request.substring(0, i) + request.substring(endOfBlock, request.length);
      } else {
        parseForVariable(request.substring(i, endOfBlock), replacements, client);
        i = endOfBlock;
      }
    } else if (request[i] === "'") {
      const quoteIndex = request.indexOf("'", i + 1);
      // Look for a closing pair, otherwise iterate to the end and return as it is
      i = quoteIndex === -1 ? request.length : quoteIndex + 1;
    } else if (request[i] === "\"") {
      const quoteIndex = request.indexOf("\"", i + 1);
      // Look for a closing pair, otherwise iterate to the end and return as it is
      i = quoteIndex === -1 ? request.length : quoteIndex + 1;
    } else {
      i += 1;
    }
  }
  return request;
};
