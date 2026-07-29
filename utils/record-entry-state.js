function createRecordEntryState(categoryId) {
  return {
    entryVisible: false,
    categoryPickerVisible: false,
    categoryId
  };
}

function transitionRecordEntry(state, action) {
  switch (action.type) {
    case 'OPEN_ENTRY':
      return { ...state, entryVisible: true, categoryPickerVisible: false };
    case 'CLOSE_ENTRY':
      return { ...state, entryVisible: false, categoryPickerVisible: false };
    case 'OPEN_CATEGORY_PICKER':
      return { ...state, entryVisible: true, categoryPickerVisible: true };
    case 'CLOSE_CATEGORY_PICKER':
      return { ...state, categoryPickerVisible: false };
    case 'SELECT_CATEGORY':
      return {
        ...state,
        entryVisible: true,
        categoryPickerVisible: false,
        categoryId: action.categoryId
      };
    default:
      return state;
  }
}

module.exports = {
  createRecordEntryState,
  transitionRecordEntry
};
