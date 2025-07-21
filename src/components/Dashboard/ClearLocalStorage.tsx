function ClearLocalStorageButton() {
  const PREFIX = 'testFixProgress';

  const handleClearLocalStorage = () => {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    alert('All loaded test data for this application has been cleared from local storage');
    window.location.reload();
  };

  return (
    <button onClick={handleClearLocalStorage} className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors">
      Clear Test Data
    </button>
  );
}

export default ClearLocalStorageButton;