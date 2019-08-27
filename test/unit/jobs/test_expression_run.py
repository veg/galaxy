import json
import os
import shutil
import subprocess
import tempfile

from galaxy.tools import expressions

THIS_DIRECTORY = os.path.abspath(os.path.dirname(__file__))
TEST_DIRECTORY = os.path.join(THIS_DIRECTORY, os.path.pardir, os.path.pardir)
ROOT_DIRECTORY = os.path.join(TEST_DIRECTORY, os.path.pardir)
LIB_DIRECTORY = os.path.join(ROOT_DIRECTORY, "lib")


def test_run_simple():
    test_directory = tempfile.mkdtemp()
    try:
        environment_path = os.path.join(test_directory, "env.json")
        environment = {
            'job': {'input1': '7'},
            'outputs': [
                {'name': 'out1', 'from_expression': "output1", 'path': 'moo'}
            ],
            'script': "{return {'output1': parseInt($job.input1)};}",
        }
        with open(environment_path, "w") as f:
            json.dump(environment, f)
        expressions.write_evalute_script(
            test_directory,
        )
        new_env = os.environ.copy()
        if "PYTHONPATH" in new_env:
            new_env['PYTHONPATH'] = "%s:%s" % (LIB_DIRECTORY, new_env["PYTHONPATH"])
        else:
            new_env['PYTHONPATH'] = "%s" % (LIB_DIRECTORY)
        new_env['GALAXY_EXPRESSION_INPUTS'] = environment_path
        p = subprocess.Popen(
            args=expressions.EXPRESSION_SCRIPT_CALL,
            shell=True,
            cwd=test_directory,
            env=new_env,
        )
        assert p.wait() == 0
        with open(os.path.join(test_directory, 'moo')) as f:
            out_content = f.read()
        assert out_content == '7', out_content
    finally:
        shutil.rmtree(test_directory)
