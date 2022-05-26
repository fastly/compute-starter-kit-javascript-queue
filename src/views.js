import styles from "./static/style.css";

// Injects styles and props into the given template.
export default function processView(template, props) {
  for (let key in props) {
    template = template.replace(
      new RegExp(`{{\\s?${key}\\s?}}`, "g"),
      props[key]
    );
  }
  return template.replace(
    "</head>",
    "<style>" + styles.replace(new RegExp("\n", "g"), "") + "</style></head>"
  );
}
