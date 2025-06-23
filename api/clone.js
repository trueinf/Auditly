app.post('/api/clone', async (req, res) => {
    const { repoUrl } = req.body;
    if (!repoUrl || !repoUrl.startsWith('https://github.com/')) {
      return res.status(400).json({ error: 'Invalid GitHub URL' });
    }
  
    const folderName = `repo_${uuidv4()}`;
    const clonePath = path.join(__dirname, 'uploads', folderName);
  
    exec(`git clone ${repoUrl} "${clonePath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(stderr);
        return res.status(500).json({ error: 'Failed to clone repo' });
      }
  
      res.json({ message: 'Repo cloned successfully', path: clonePath });
    });
  });
  