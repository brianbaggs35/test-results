function ClearsessionStorageButton() {
  const PREFIX = 'testFixProgress';

  const handleClearsessionStorage = () => {
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith(PREFIX)) {
        sessionStorage.removeItem(key);
      }
    });
    alert('All loaded test data for this application has been cleared from local storage');
    window.location.reload();
  };

  return (
    <button onClick={handleClearsessionStorage}>
      Clear Test Data
    </button>
  );
}

export default ClearsessionStorageButton;