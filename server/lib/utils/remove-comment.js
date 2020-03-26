// @flow

/*
 * Detects whether or not the current index of a string shows a beginning of a comment block such as "/*"
 * @param request as the string to parse
 * @param index as the cursor to start looking in the request
 * @returns true when a comment block starts | false otherwise }
 */
function isStartOfCommentBlock(request: string, index: number): boolean {
  return index >= 0 && index + 1 < request.length &&
    request[index] === "/" && request[index + 1] === "*";
}

function isEndOfCommentBlock(request: string, index: number): boolean {
  return index >= 0 && index + 1 < request.length &&
    request[index] === "*" && request[index + 1] === "/";
}

function isStartOfCommentLine(request: string, index: number): boolean {
  return index >= 0 && index + 1 < request.length &&
      request[index] === "-" && request[index + 1] === "-";
}

function deleteUntilEndOfLine(request: string, index: number): string {
  let end = index;
  while (end >= 0 && end < request.length && request[end] !== "\r" && request[end] !== "\n") {
    end += 1;
  }
  return request.substring(0, index) + request.substring(end, request.length);
}

function deleteUntilEndOfCommentBlock(request: string, index: number): string {
  let end = index + 2, counter = 1;
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
  request = request.substring(0, index) + request.substring(end, request.length);
  return request;
}

/* test /* */
// The comment block above isn't correct inside the SQL editor
// When parsing through the sql request, do as follow when you meet the set of character:
// '      => look for closing pair and ignore everything between
// --     => look for end of line and remove everything between
// /*     => start looking for end of comment block
//            To do so, count everytime you read a /* by increasing a counter
//            When you read */ decrease the counter
//            When it goes down to zero, you met the end of that block
export default (request: string) => {
  let i = 0;
  while (i < request.length) {
    if (isStartOfCommentLine(request, i)) {
      request = deleteUntilEndOfLine(request, i);
    } else if (isStartOfCommentBlock(request, i)) {
      request = deleteUntilEndOfCommentBlock(request, i);
    } else if (request[i] === "'") {
      const quoteIndex = request.indexOf("'", i + 1);
      // Look for a closing pair, otherwise iterate to the end and return as it is
      i = quoteIndex === -1 ? request.length : quoteIndex + 1;
    } else {
      i += 1;
    }
  }
  return request;
};
