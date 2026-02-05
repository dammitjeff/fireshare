#Setup Virtual Environment
python3 -m venv venv
source venv/bin/activate
source .env.dev

pip install --upgrade pip setuptools wheel
pip install -r app/server/requirements.txt
cd app/server && python3 setup.py install && cd ../..

flask db upgrade
flask run --with-threads