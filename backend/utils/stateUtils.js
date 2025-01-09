import stateMapping from "./stateMapping.js";

const getStateCode = (stateFullName) => {
  return stateMapping[stateFullName] || null;
};

export default {
  getStateCode,
};
