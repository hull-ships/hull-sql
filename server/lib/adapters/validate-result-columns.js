import _ from "lodash";

export default function validate(columnNames, import_type = "users") {
  const errors = [];
  switch (import_type) {
    case "users":
      if (["email", "external_id"].every(key => !_.includes(columnNames, key))) {
        errors.push("Column names should include email and/or external_id");
      }
      break;
    case "accounts":
      if (["domain", "external_id"].every(key => !_.includes(columnNames, key))) {
        errors.push("Column names should include domain and/or external_id");
      }
      break;
    case "events":
      if (["timestamp", "event", "external_id"].some(key => !_.includes(columnNames, key))) {
        errors.push("Column names should include event, timestamp and external_id");
      }
      break;
    default:
      break;
  }


  const incorrectColumnNames = [];
  _.forEach(columnNames, (column) => {
    if (column.includes(".") || column.includes("$")) {
      incorrectColumnNames.push(column);
    }
  });

  if (incorrectColumnNames.length > 0) {
    errors.push(`Following column names should not contain special characters ('$', '.') : ${incorrectColumnNames.join(", ")}`);
  }
  return { errors };
}
