import _ from "lodash";

export default function validate(columnNames) {
  const errors = [];

  if (!_.includes(columnNames, "email") && !_.includes(columnNames, "external_id")) {
    errors.push("Column names should include at least one required parameters: email or external_id");
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
  return { isValid: errors.length > 0, errors };
}
