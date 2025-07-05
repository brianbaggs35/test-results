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
    <button onClick={handleClearLocalStorage}>
      Clear Test Data
    </button>
  );
}

export default ClearLocalStorageButton;