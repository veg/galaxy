# -*- coding: utf-8 -*-
import time

from requests import (
    post,
    put
)

from base import api  # noqa: I100,I202
from base.populators import (  # noqa: I100
    DatasetCollectionPopulator,
    DatasetPopulator,
)


class HistoriesApiTestCase(api.ApiTestCase):

    def setUp(self):
        super(HistoriesApiTestCase, self).setUp()
        self.dataset_populator = DatasetPopulator(self.galaxy_interactor)
        self.dataset_collection_populator = DatasetCollectionPopulator(self.galaxy_interactor)

    def test_create_history(self):
        # Create a history.
        create_response = self._create_history("TestHistory1")
        created_id = create_response["id"]

        # Make sure new history appears in index of user's histories.
        index_response = self._get("histories").json()
        indexed_history = [h for h in index_response if h["id"] == created_id][0]
        self.assertEqual(indexed_history["name"], "TestHistory1")

    def test_show_history(self):
        history_id = self._create_history("TestHistoryForShow")["id"]
        show_response = self._show(history_id)
        self._assert_has_key(
            show_response,
            'id', 'name', 'annotation', 'size', 'contents_url',
            'state', 'state_details', 'state_ids'
        )

        state_details = show_response["state_details"]
        state_ids = show_response["state_ids"]
        states = [
            'discarded', 'empty', 'error', 'failed_metadata', 'new',
            'ok', 'paused', 'queued', 'running', 'setting_metadata', 'upload'
        ]
        assert isinstance(state_details, dict)
        assert isinstance(state_ids, dict)
        self._assert_has_keys(state_details, *states)
        self._assert_has_keys(state_ids, *states)

    def test_show_most_recently_used(self):
        history_id = self._create_history("TestHistoryRecent")["id"]
        show_response = self._get("histories/most_recently_used").json()
        assert show_response["id"] == history_id

    def test_index_order(self):
        slightly_older_history_id = self._create_history("TestHistorySlightlyOlder")["id"]
        newer_history_id = self._create_history("TestHistoryNewer")["id"]
        index_response = self._get("histories").json()
        assert index_response[0]["id"] == newer_history_id
        assert index_response[1]["id"] == slightly_older_history_id

    def test_delete(self):
        # Setup a history and ensure it is in the index
        history_id = self._create_history("TestHistoryForDelete")["id"]
        index_response = self._get("histories").json()
        assert index_response[0]["id"] == history_id

        show_response = self._show(history_id)
        assert not show_response["deleted"]

        # Delete the history
        self._delete("histories/%s" % history_id)

        # Check can view it - but it is deleted
        show_response = self._show(history_id)
        assert show_response["deleted"]

        # Verify it is dropped from history index
        index_response = self._get("histories").json()
        assert len(index_response) == 0 or index_response[0]["id"] != history_id

        # Add deleted filter to index to view it
        index_response = self._get("histories", {"deleted": "true"}).json()
        assert index_response[0]["id"] == history_id

    def test_purge(self):
        history_id = self._create_history("TestHistoryForPurge")["id"]
        data = {'purge': True}
        self._delete("histories/%s" % history_id, data=data)
        show_response = self._show(history_id)
        assert show_response["deleted"]
        assert show_response["purged"]

    def test_undelete(self):
        history_id = self._create_history("TestHistoryForDeleteAndUndelete")["id"]
        self._delete("histories/%s" % history_id)
        self._post("histories/deleted/%s/undelete" % history_id)
        show_response = self._show(history_id)
        assert not show_response["deleted"]

    def test_update(self):
        history_id = self._create_history("TestHistoryForUpdating")["id"]

        self._update(history_id, {"name": "New Name"})
        show_response = self._show(history_id)
        assert show_response["name"] == "New Name"

        unicode_name = u'桜ゲノム'
        self._update(history_id, {"name": unicode_name})
        show_response = self._show(history_id)
        assert show_response["name"] == unicode_name, show_response

        quoted_name = "'MooCow'"
        self._update(history_id, {"name": quoted_name})
        show_response = self._show(history_id)
        assert show_response["name"] == quoted_name

        self._update(history_id, {"deleted": True})
        show_response = self._show(history_id)
        assert show_response["deleted"], show_response

        self._update(history_id, {"deleted": False})
        show_response = self._show(history_id)
        assert not show_response["deleted"]

        self._update(history_id, {"published": True})
        show_response = self._show(history_id)
        assert show_response["published"]

        self._update(history_id, {"genome_build": "hg18"})
        show_response = self._show(history_id)
        assert show_response["genome_build"] == "hg18"

        self._update(history_id, {"annotation": "The annotation is cool"})
        show_response = self._show(history_id)
        assert show_response["annotation"] == "The annotation is cool"

        self._update(history_id, {"annotation": unicode_name})
        show_response = self._show(history_id)
        assert show_response["annotation"] == unicode_name, show_response

        self._update(history_id, {"annotation": quoted_name})
        show_response = self._show(history_id)
        assert show_response["annotation"] == quoted_name

    def test_update_invalid_attribute(self):
        history_id = self._create_history("TestHistoryForInvalidUpdating")["id"]
        put_response = self._update(history_id, {"invalidkey": "moo"})
        assert "invalidkey" not in put_response.json()

    def test_update_invalid_types(self):
        history_id = self._create_history("TestHistoryForUpdatingInvalidTypes")["id"]
        for str_key in ["name", "annotation"]:
            assert self._update(history_id, {str_key: False}).status_code == 400

        for bool_key in ['deleted', 'importable', 'published']:
            assert self._update(history_id, {bool_key: "a string"}).status_code == 400

        assert self._update(history_id, {"tags": "a simple string"}).status_code == 400
        assert self._update(history_id, {"tags": [True]}).status_code == 400

    def test_invalid_keys(self):
        invalid_history_id = "1234123412341234"

        assert self._get("histories/%s" % invalid_history_id).status_code == 400
        assert self._update(invalid_history_id, {"name": "new name"}).status_code == 400
        assert self._delete("histories/%s" % invalid_history_id).status_code == 400
        assert self._post("histories/deleted/%s/undelete" % invalid_history_id).status_code == 400

    def test_create_anonymous_fails(self):
        post_data = dict(name="CannotCreate")
        # Using lower-level _api_url will cause key to not be injected.
        histories_url = self._api_url("histories")
        create_response = post(url=histories_url, data=post_data)
        self._assert_status_code_is(create_response, 403)

    def test_import_export(self):
        history_name = "for_export_default"
        history_id = self.dataset_populator.new_history(name=history_name)
        self.dataset_populator.new_dataset(history_id, content="1 2 3")
        deleted_hda = self.dataset_populator.new_dataset(history_id, content="1 2 3")
        self.dataset_populator.delete_dataset(history_id, deleted_hda["id"])
        deleted_details = self.dataset_populator.get_history_dataset_details(history_id, id=deleted_hda["id"])
        assert deleted_details["deleted"]
        imported_history_id = self._reimport_history(history_id, history_name, wait_on_history_length=2)

        def upload_job_check(job):
            assert job["tool_id"] == "upload1"

        def check_discarded(hda):
            assert hda["deleted"]
            assert hda["state"] == "discarded", hda
            assert hda["purged"] is True

        self._check_imported_dataset(history_id=imported_history_id, hid=1, job_checker=upload_job_check)
        self._check_imported_dataset(history_id=imported_history_id, hid=2, has_job=False, hda_checker=check_discarded, job_checker=upload_job_check)

        imported_content = self.dataset_populator.get_history_dataset_content(
            history_id=imported_history_id,
            hid=1,
        )
        assert imported_content == "1 2 3\n"

    def test_import_1901_histories(self):
        f = open(self.test_data_resolver.get_filename("exports/1901_two_datasets.tgz"), 'rb')
        import_data = dict(archive_source='', archive_file=f)
        self._import_history_and_wait(import_data, "API Test History", wait_on_history_length=2)

    def test_import_export_include_deleted(self):
        history_name = "for_export_include_deleted"
        history_id = self.dataset_populator.new_history(name=history_name)
        self.dataset_populator.new_dataset(history_id, content="1 2 3")
        deleted_hda = self.dataset_populator.new_dataset(history_id, content="1 2 3")
        self.dataset_populator.delete_dataset(history_id, deleted_hda["id"])

        imported_history_id = self._reimport_history(history_id, history_name, wait_on_history_length=2, export_kwds={"include_deleted": "True"})
        self._assert_history_length(imported_history_id, 2)

        def upload_job_check(job):
            assert job["tool_id"] == "upload1"

        def check_ok(hda):
            assert hda["state"] == "ok", hda
            assert hda["deleted"] is True, hda

        self._check_imported_dataset(history_id=imported_history_id, hid=1, job_checker=upload_job_check)
        self._check_imported_dataset(history_id=imported_history_id, hid=2, hda_checker=check_ok, job_checker=upload_job_check)

        imported_content = self.dataset_populator.get_history_dataset_content(
            history_id=imported_history_id,
            hid=1,
        )
        assert imported_content == "1 2 3\n"

    def test_import_metadata_regeneration(self):
        history_name = "for_import_metadata_regeneration"
        history_id = self.dataset_populator.new_history(name=history_name)
        self.dataset_populator.new_dataset(history_id, content=open(self.test_data_resolver.get_filename("1.bam"), 'rb'), file_type='bam', wait=True)
        imported_history_id = self._reimport_history(history_id, history_name)
        self._assert_history_length(imported_history_id, 1)
        self._check_imported_dataset(history_id=imported_history_id, hid=1)
        import_bam_metadata = self.dataset_populator.get_history_dataset_details(
            history_id=imported_history_id,
            hid=1,
        )
        # The cleanup() method of the __IMPORT_HISTORY__ job (which is executed
        # after the job has entered its final state):
        # - creates a new dataset with 'ok' state and adds it to the history
        # - starts a __SET_METADATA__ job to regenerate the dataset metadata, if
        #   needed
        # We need to wait a bit for the creation of the __SET_METADATA__ job.
        time.sleep(1)
        self.dataset_populator.wait_for_history_jobs(imported_history_id, assert_ok=True)
        bai_metadata = import_bam_metadata["meta_files"][0]
        assert bai_metadata["file_type"] == "bam_index"
        api_url = bai_metadata["download_url"].split("api/", 1)[1]
        bai_response = self._get(api_url)
        self._assert_status_code_is(bai_response, 200)
        assert len(bai_response.content) > 4

    def test_import_export_collection(self):
        history_name = "for_export_with_collections"
        history_id = self.dataset_populator.new_history(name=history_name)
        self.dataset_collection_populator.create_list_in_history(history_id, contents=["Hello", "World"], direct_upload=True)

        imported_history_id = self._reimport_history(history_id, history_name, wait_on_history_length=3)
        self._assert_history_length(imported_history_id, 3)

        def check_elements(elements):
            assert len(elements) == 2
            element0 = elements[0]["object"]
            element1 = elements[1]["object"]
            for element in [element0, element1]:
                assert not element["visible"]
                assert not element["deleted"]
                assert element["state"] == "ok"

            assert element0["hid"] == 2
            assert element1["hid"] == 3

        self._check_imported_collection(imported_history_id, hid=1, collection_type="list", elements_checker=check_elements)

    def test_import_export_nested_collection(self):
        history_name = "for_export_with_nested_collections"
        history_id = self.dataset_populator.new_history(name=history_name)
        self.dataset_collection_populator.create_list_of_pairs_in_history(history_id)

        imported_history_id = self._reimport_history(history_id, history_name, wait_on_history_length=3)
        self._assert_history_length(imported_history_id, 3)

        def check_elements(elements):
            assert len(elements) == 1
            element0 = elements[0]["object"]
            self._assert_has_keys(element0, "elements", "collection_type")

            child_elements = element0["elements"]

            assert len(child_elements) == 2
            assert element0["collection_type"] == "paired"

        self._check_imported_collection(imported_history_id, hid=1, collection_type="list:paired", elements_checker=check_elements)

    def _reimport_history(self, history_id, history_name, wait_on_history_length=None, export_kwds={}):
        # Ensure the history is ready to go...
        self.dataset_populator.wait_for_history(history_id, assert_ok=True)

        return self.dataset_populator.reimport_history(
            history_id, history_name, wait_on_history_length=wait_on_history_length, export_kwds=export_kwds, url=self.url, api_key=self.galaxy_interactor.api_key
        )

    def _import_history_and_wait(self, import_data, history_name, wait_on_history_length=None):

        imported_history_id = self.dataset_populator.import_history_and_wait_for_name(import_data, history_name)

        if wait_on_history_length:
            self.dataset_populator.wait_on_history_length(imported_history_id, wait_on_history_length)

        return imported_history_id

    def _assert_history_length(self, history_id, n):
        contents_response = self._get("histories/%s/contents" % history_id)
        self._assert_status_code_is(contents_response, 200)
        contents = contents_response.json()
        assert len(contents) == n, contents

    def _check_imported_dataset(self, history_id, hid, has_job=True, hda_checker=None, job_checker=None):
        imported_dataset_metadata = self.dataset_populator.get_history_dataset_details(
            history_id=history_id,
            hid=hid,
        )
        assert imported_dataset_metadata["history_content_type"] == "dataset"
        assert imported_dataset_metadata["history_id"] == history_id

        if hda_checker is not None:
            hda_checker(imported_dataset_metadata)

        assert "creating_job" in imported_dataset_metadata
        job_id = imported_dataset_metadata["creating_job"]
        if has_job:
            assert job_id

            job_details = self.dataset_populator.get_job_details(job_id, full=True)
            assert job_details.status_code == 200, job_details.content
            job = job_details.json()
            assert 'history_id' in job, job
            assert job['history_id'] == history_id, job

            if job_checker is not None:
                job_checker(job)

    def _check_imported_collection(self, history_id, hid, collection_type=None, elements_checker=None):
        imported_collection_metadata = self.dataset_populator.get_history_collection_details(
            history_id=history_id,
            hid=hid,
        )
        assert imported_collection_metadata["history_content_type"] == "dataset_collection"
        assert imported_collection_metadata["history_id"] == history_id
        assert "collection_type" in imported_collection_metadata
        assert "elements" in imported_collection_metadata
        if collection_type is not None:
            assert imported_collection_metadata["collection_type"] == collection_type, imported_collection_metadata

        if elements_checker is not None:
            elements_checker(imported_collection_metadata["elements"])

    def test_create_tag(self):
        post_data = dict(name="TestHistoryForTag")
        history_id = self._post("histories", data=post_data).json()["id"]
        tag_data = dict(value="awesometagvalue")
        tag_url = "histories/%s/tags/awesometagname" % history_id
        tag_create_response = self._post(tag_url, data=tag_data)
        self._assert_status_code_is(tag_create_response, 200)

    def _show(self, history_id):
        return self._get("histories/%s" % history_id).json()

    def _update(self, history_id, data):
        update_url = self._api_url("histories/%s" % history_id, use_key=True)
        put_response = put(update_url, json=data)
        return put_response

    def _create_history(self, name):
        post_data = dict(name=name)
        create_response = self._post("histories", data=post_data).json()
        self._assert_has_keys(create_response, "name", "id")
        self.assertEqual(create_response["name"], name)
        return create_response

    # TODO: (CE) test_create_from_copy
