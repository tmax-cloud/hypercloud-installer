/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
import AbstractInstaller from './AbstractInstaller';
import Env, { NETWORK_TYPE } from '../Env';
import * as scp from '../../common/scp';
import Node from '../Node';
import * as ssh from '../../common/ssh';
import * as git from '../../common/git';
import CONST from '../../constants/constant';
import ScriptFactory from '../script/ScriptFactory';
import * as common from '../../common/common';
import AbstractScript from '../script/AbstractScript';

export default class KubernetesInstaller extends AbstractInstaller {
  public static readonly IMAGE_DIR = `k8s-install`;

  public static readonly ARCHIVE_DIR = `archive_20.07.10`;

  public static readonly INSTALL_HOME = `${Env.INSTALL_ROOT}/install-k8s`;

  public static readonly IMAGE_REGISTRY_INSTALL_HOME = `${Env.INSTALL_ROOT}/hypercloud-install-guide/Image_Registry/installer`;

  public static readonly IMAGE_HOME = `${Env.INSTALL_ROOT}/${KubernetesInstaller.IMAGE_DIR}`;

  public static readonly ARCHIVE_HOME = `${Env.INSTALL_ROOT}/${KubernetesInstaller.ARCHIVE_DIR}`;

  public static readonly K8S_VERSION = `1.17.6`;

  public static readonly CRIO_VERSION = `1.17`;

  // singleton
  private static instance: KubernetesInstaller;

  private constructor() {
    super();
  }

  static get getInstance() {
    if (!KubernetesInstaller.instance) {
      KubernetesInstaller.instance = new KubernetesInstaller();
    }
    return this.instance;
  }

  /**
   * abstract 메서드 구현부
   */
  public async install(param: {
    registry: string;
    version: string;
    podSubnet: string;
    callback: any;
    setProgress: Function;
  }) {
    const { registry, version, podSubnet, callback, setProgress } = param;

    await this._envSetting({
      registry,
      callback
    });
    setProgress(20);

    await this.preWorkInstall({
      registry,
      callback
    });
    setProgress(40);

    await this._installMainMaster(registry, version, podSubnet, callback);
    setProgress(60);

    await this._installMaster(registry, version, callback);
    setProgress(80);

    await this._installWorker(registry, version, callback);

    await this._makeMasterCanSchedule();
    setProgress(100);
  }

  public async remove() {
    await this._removeWorker();
    await this._removeMaster();
    await this._removeMainMaster();
  }

  protected async preWorkInstall(param: { registry?: string; callback: any }) {
    console.debug('@@@@@@ Start pre-installation... @@@@@@');
    const { registry, callback } = param;
    if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
      // internal network 경우 해주어야 할 작업들
      /**
       * 1. 해당 이미지 파일 다운(client 로컬), 전송 (main 마스터 노드)
       * 2. git guide 다운(client 로컬), 전송(각 노드)
       */
      await this.downloadImageFile();
      await this.sendImageFile();

      await this._downloadGitFile();
      await this._sendGitFile();
    } else if (this.env.networkType === NETWORK_TYPE.EXTERNAL) {
      // external network 경우 해주어야 할 작업들
      /**
       * 1. public 패키지 레포 등록, 설치 (각 노드) (필요 시)
       * 2. git guide clone (각 노드)
       */
      await this._setPublicPackageRepository(callback);
      await this._installPackage(callback);
      await this._cloneGitFile(callback);
    }

    if (registry) {
      // 내부 image registry 구축 경우 해주어야 할 작업들
      /**
       * 1. 레지스트리 관련 작업
       */
      await this.registryWork({
        registry,
        callback
      });
    }
    console.debug('###### Finish pre-installation... ######');
  }

  protected async downloadImageFile() {
    // TODO: download kubernetes image file
    console.debug(
      '@@@@@@ Start downloading the image file to client local... @@@@@@'
    );
    console.debug(
      '###### Finish downloading the image file to client local... ######'
    );
  }

  protected async sendImageFile() {
    console.debug(
      '@@@@@@ Start sending the image file to main master node... @@@@@@'
    );
    const { mainMaster } = this.env.getNodesSortedByRole();
    const srcPath = `${Env.LOCAL_INSTALL_ROOT}/${KubernetesInstaller.IMAGE_DIR}/`;
    await scp.sendFile(
      mainMaster,
      srcPath,
      `${KubernetesInstaller.IMAGE_HOME}/`
    );
    console.debug(
      '###### Finish sending the image file to main master node... ######'
    );
  }

  protected async registryWork(param: { registry: any; callback: any }) {
    console.debug(
      '@@@@@@ Start pushing the image at main master node... @@@@@@'
    );
    const { registry, callback } = param;
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = this.getImagePushScript(registry);
    await mainMaster.exeCmd(callback);
    console.debug(
      '###### Finish pushing the image at main master node... ######'
    );
  }

  protected getImagePushScript(registry: string): string {
    const path = `~/${KubernetesInstaller.IMAGE_HOME}`;
    let gitPullCommand = `
      mkdir -p ${path};
      cd ${path};
      `;
    if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
      gitPullCommand += `
        sudo docker load -i kube-apiserver.tar;
        sudo docker load -i kube-scheduler.tar;
        sudo docker load -i kube-controller-manager.tar ;
        sudo docker load -i kube-proxy.tar;
        sudo docker load -i etcd.tar;
        sudo docker load -i coredns.tar;
        sudo docker load -i pause.tar;
        `;
    } else {
      gitPullCommand += `
        sudo docker pull k8s.gcr.io/kube-proxy:v1.17.6;
        sudo docker pull k8s.gcr.io/kube-apiserver:v1.17.6;
        sudo docker pull k8s.gcr.io/kube-controller-manager:v1.17.6;
        sudo docker pull k8s.gcr.io/kube-scheduler:v1.17.6;
        sudo docker pull k8s.gcr.io/etcd:3.4.3-0;
        sudo docker pull k8s.gcr.io/coredns:1.6.5;
        sudo docker pull k8s.gcr.io/pause:3.1;
        `;
    }

    return `
        ${gitPullCommand}
        sudo docker tag k8s.gcr.io/kube-apiserver:v1.17.6 ${registry}/k8s.gcr.io/kube-apiserver:v1.17.6;
        sudo docker tag k8s.gcr.io/kube-proxy:v1.17.6 ${registry}/k8s.gcr.io/kube-proxy:v1.17.6;
        sudo docker tag k8s.gcr.io/kube-controller-manager:v1.17.6 ${registry}/k8s.gcr.io/kube-controller-manager:v1.17.6;
        sudo docker tag k8s.gcr.io/etcd:3.4.3-0 ${registry}/k8s.gcr.io/etcd:3.4.3-0;
        sudo docker tag k8s.gcr.io/coredns:1.6.5 ${registry}/k8s.gcr.io/coredns:1.6.5;
        sudo docker tag k8s.gcr.io/kube-scheduler:v1.17.6 ${registry}/k8s.gcr.io/kube-scheduler:v1.17.6;
        sudo docker tag k8s.gcr.io/pause:3.1 ${registry}/k8s.gcr.io/pause:3.1;

        sudo docker push ${registry}/k8s.gcr.io/kube-apiserver:v1.17.6;
        sudo docker push ${registry}/k8s.gcr.io/kube-proxy:v1.17.6;
        sudo docker push ${registry}/k8s.gcr.io/kube-controller-manager:v1.17.6;
        sudo docker push ${registry}/k8s.gcr.io/etcd:3.4.3-0;
        sudo docker push ${registry}/k8s.gcr.io/coredns:1.6.5;
        sudo docker push ${registry}/k8s.gcr.io/kube-scheduler:v1.17.6;
        sudo docker push ${registry}/k8s.gcr.io/pause:3.1;
        #rm -rf ${path};
        `;
  }

  /**
   * public 메서드
   */
  public async addMaster(registry: string, version: string, callback?: any) {
    await this._envSetting({ callback });
    await this.preWorkInstall({ callback });
    await this._installMaster(registry, version, callback);
  }

  public async deleteWorker() {
    console.debug('@@@@@@ Start deleting Worker... @@@@@@');
    const { mainMaster, workerArr } = this.env.getNodesSortedByRole();
    let command = '';
    workerArr.map(worker => {
      command += AbstractScript.getDeleteWorkerNodeScript(worker);
    });
    mainMaster.cmd = command;
    await mainMaster.exeCmd();

    workerArr.map(worker => {
      const script = ScriptFactory.createScript(worker.os.type);
      command = script.getK8sMasterRemoveScript();
      worker.cmd = command;
      worker.exeCmd();
    });
    console.debug('###### Finish deleting Worker... ######');
  }

  public async addWorker(registry: string, version: string, callback?: any) {
    await this._envSetting({ callback });
    await this.preWorkInstall({ callback });
    await this._installWorker(registry, version, callback);
  }

  public async deleteMaster() {
    console.debug('@@@@@@ Start deleting Master... @@@@@@');

    const { mainMaster, masterArr } = this.env.getNodesSortedByRole();
    console.log(masterArr);
    let command = '';

    await Promise.all(
      masterArr.map(master => {
        const script = ScriptFactory.createScript(master.os.type);
        command = script.getK8sMasterRemoveScript();
        master.cmd = command;
        return master.exeCmd();
      })
    );

    command = '';
    masterArr.map(master => {
      command += AbstractScript.getDeleteWorkerNodeScript(master);
    });
    mainMaster.cmd = command;
    await mainMaster.exeCmd();

    console.debug('###### Finish deleting Master... ######');
  }

  /**
   * private 메서드
   */
  private async _installMainMaster(
    registry: string,
    version: string,
    podSubnet: string,
    callback: any
  ) {
    console.debug('@@@@@@ Start installing main Master... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = this._getK8sMainMasterInstallScript(
      mainMaster,
      registry,
      version,
      podSubnet,
      true
    );
    await mainMaster.exeCmd(callback);
    console.debug('###### Finish installing main Master... ######');
  }

  private async _installMaster(
    registry: string,
    version: string,
    callback: any
  ) {
    console.debug('@@@@@@ Start installing Master... @@@@@@');
    const { mainMaster, masterArr } = this.env.getNodesSortedByRole();
    const masterJoinCmd = await this._getMasterJoinCmd(mainMaster);
    await Promise.all(
      masterArr.map((master, index) => {
        master.cmd = this._getK8sMasterInstallScript(
          registry,
          version,
          master,
          Math.floor(Math.random() * 99999999)
        );
        master.cmd += `${masterJoinCmd.trim()} --cri-socket=/var/run/crio/crio.sock;`;
        return master.exeCmd(callback);
      })
    );
    console.debug('###### Finish installing Master... ######');
  }

  private async _installWorker(
    registry: string,
    version: string,
    callback?: any
  ) {
    console.debug('@@@@@@ Start installing Worker... @@@@@@');
    const { mainMaster, workerArr } = this.env.getNodesSortedByRole();
    const workerJoinCmd = await this._getWorkerJoinCmd(mainMaster);
    await Promise.all(
      workerArr.map(worker => {
        worker.cmd = this._getK8sWorkerInstallScript(registry, version, worker);
        worker.cmd += `${workerJoinCmd.trim()} --cri-socket=/var/run/crio/crio.sock;`;
        return worker.exeCmd(callback);
      })
    );
    console.debug('###### Finish installing Worker... ######');
  }

  private async _removeWorker() {
    console.debug('@@@@@@ Start remove Worker... @@@@@@');
    const { workerArr } = this.env.getNodesSortedByRole();
    await Promise.all(
      workerArr.map((worker: Node) => {
        const script = ScriptFactory.createScript(worker.os.type);
        worker.cmd = script.getK8sMasterRemoveScript();
        return worker.exeCmd();
      })
    );
    console.debug('###### Finish remove Worker... ######');
  }

  private async _removeMaster() {
    console.debug('@@@@@@ Start remove Master... @@@@@@');
    const { masterArr } = this.env.getNodesSortedByRole();
    await Promise.all(
      masterArr.map((master: Node) => {
        const script = ScriptFactory.createScript(master.os.type);
        master.cmd = script.getK8sMasterRemoveScript();
        return master.exeCmd();
      })
    );
    console.debug('###### Finish remove Master... ######');
  }

  private async _removeMainMaster() {
    console.debug('@@@@@@ Start remove main Master... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    const script = ScriptFactory.createScript(mainMaster.os.type);
    mainMaster.cmd = script.getK8sMasterRemoveScript();
    await mainMaster.exeCmd();
    console.debug('###### Finish remove main Master... ######');
  }

  private async _downloadPackageFile() {
    // TODO: download package file
    console.debug(
      '@@@@@@ Start downloading the package file to client local... @@@@@@'
    );
    console.debug(
      '###### Finish downloading the package file to client local... ######'
    );
  }

  private async _sendPackageFile() {
    console.debug(
      '@@@@@@ Start sending the package file to each node (using scp)... @@@@@@'
    );
    const srcPath = `${Env.LOCAL_INSTALL_ROOT}/${KubernetesInstaller.ARCHIVE_DIR}/`;
    const destPath = `${KubernetesInstaller.ARCHIVE_HOME}/`;
    console.debug(`srcPath`, srcPath);
    console.debug(`destPath`, destPath);
    await Promise.all(
      this.env.nodeList.map(node => {
        return scp.sendFile(node, srcPath, destPath);
      })
    );
    console.debug(
      '###### Finish sending the package file to each node (using scp)... ######'
    );
  }

  private async _installLocalPackageRepository(callback: any) {
    console.debug(
      '@@@@@@ Start installing the local package repository at each node... @@@@@@'
    );
    const destPath = `${KubernetesInstaller.ARCHIVE_HOME}/`;
    await Promise.all(
      this.env.nodeList.map((node: Node) => {
        const script = ScriptFactory.createScript(node.os.type);
        node.cmd = script.setPackageRepository(destPath);
        return node.exeCmd(callback);
      })
    );
    console.debug(
      '###### Finish installing the local package repository at each node... ######'
    );
  }

  private async _downloadGitFile() {
    console.debug(
      '@@@@@@ Start downloading the GIT file to client local... @@@@@@'
    );
    const localPath = `${Env.LOCAL_INSTALL_ROOT}/hypercloud-install-guide/`;
    console.debug(`repoPath`, CONST.K8S_REPO);
    console.debug(`localPath`, localPath);
    await git.clone(CONST.K8S_REPO, localPath, [`-b${CONST.GIT_BRANCH}`]);
    console.debug(
      '###### Finish downloading the GIT file to client local... ######'
    );
  }

  private async _sendGitFile() {
    console.debug(
      '@@@@@@ Start sending the GIT file to each node (using scp)... @@@@@@'
    );
    const localPath = `${Env.LOCAL_INSTALL_ROOT}/hypercloud-install-guide/`;
    const destPath = `${Env.INSTALL_ROOT}/hypercloud-install-guide/`;
    await Promise.all(
      this.env.nodeList.map(node => {
        return scp.sendFile(node, localPath, destPath);
      })
    );
    console.debug(
      '###### Finish sending the GIT file to each node (using scp)... ######'
    );
  }

  private async _cloneGitFile(callback: any) {
    console.debug('@@@@@@ Start clone the GIT file at each node... @@@@@@');
    await Promise.all(
      this.env.nodeList.map((node: Node) => {
        const script = ScriptFactory.createScript(node.os.type);
        node.cmd = script.cloneGitFile(CONST.K8S_REPO, CONST.GIT_BRANCH);
        return node.exeCmd(callback);
      })
    );
    console.debug('###### Finish clone the GIT file at each node... ######');
  }

  private async _installPackage(callback: any) {
    console.debug('@@@@@@ Start package install... @@@@@@');
    await Promise.all(
      this.env.nodeList.map((node: Node) => {
        const script = ScriptFactory.createScript(node.os.type);
        node.cmd = script.installPackage();
        return node.exeCmd(callback);
      })
    );
    console.debug('###### Finish package install... ######');
  }

  private async _installImageRegistry(registry: string, callback: any) {
    console.debug(
      '@@@@@@ Start installing the image registry at main master node... @@@@@@'
    );
    const { mainMaster } = this.env.getNodesSortedByRole();
    const script = ScriptFactory.createScript(mainMaster.os.type);
    mainMaster.cmd = script.getImageRegistrySettingScript(
      registry,
      this.env.networkType
    );
    await mainMaster.exeCmd(callback);
    console.debug(
      '###### Finish installing the image registry at main master node... ######'
    );
  }

  private async _setPublicPackageRepository(callback: any) {
    console.debug(
      '@@@@@@ Start setting the public package repository at each node... @@@@@@'
    );
    await Promise.all(
      this.env.nodeList.map((node: Node) => {
        const script = ScriptFactory.createScript(node.os.type);
        node.cmd = script.setCrioRepo(KubernetesInstaller.CRIO_VERSION);
        node.cmd += script.setKubernetesRepo();
        return node.exeCmd(callback);
      })
    );
    console.debug(
      '###### Finish setting the public package repository at each node... ######'
    );
  }

  private _getK8sMainMasterInstallScript(
    mainMaster: Node,
    registry: string,
    version: string,
    podSubnet: string,
    isMultiMaster: boolean
  ): string {
    const script = ScriptFactory.createScript(mainMaster.os.type);
    return `
      ${AbstractScript.setHostName(mainMaster.hostName)}
      ${AbstractScript.registHostName()}
      ${
        isMultiMaster
          ? script.getMasterMultiplexingScript(
              mainMaster,
              99999999,
              this.env.virtualIp
            )
          : ''
      }
      ${AbstractScript.setK8sConfig(
        registry,
        version,
        this.env.virtualIp,
        podSubnet
      )}
      ${script.setEnvForKubernetes()}
      ${script.startInstallCrio()}
      ${script.startInstallKubernetes()}
      ${AbstractScript.initKube()}
      ${AbstractScript.makeMasterKubeConfig()}
      ${common.getDeleteDuplicationCommandByFilePath(
        `/etc/sysctl.d/99-kubernetes-cri.conf`
      )}
      `;
  }

  private _getK8sMasterInstallScript(
    registry: string,
    version: string,
    master: Node,
    priority: number
  ): string {
    const script = ScriptFactory.createScript(master.os.type);
    return `
      ${AbstractScript.setHostName(master.hostName)}
      ${AbstractScript.registHostName()}
      ${script.getMasterMultiplexingScript(
        master,
        priority,
        this.env.virtualIp
      )}
      ${AbstractScript.setK8sConfig(registry, version, this.env.virtualIp)}
      ${script.setEnvForKubernetes()}
      ${script.startInstallCrio()}
      ${script.startInstallKubernetes()}
      ${AbstractScript.makeMasterKubeConfig()}
      ${common.getDeleteDuplicationCommandByFilePath(
        `/etc/sysctl.d/99-kubernetes-cri.conf`
      )}
      `;
  }

  private _getK8sWorkerInstallScript(
    registry: string,
    version: string,
    worker: Node
  ): string {
    const script = ScriptFactory.createScript(worker.os.type);
    return `
      ${AbstractScript.setHostName(worker.hostName)}
      ${AbstractScript.registHostName()}
      ${AbstractScript.setK8sConfig(registry, version, this.env.virtualIp)}
      ${script.setEnvForKubernetes()}
      ${script.startInstallCrio()}
      ${script.startInstallKubernetes()}
      ${common.getDeleteDuplicationCommandByFilePath(
        `/etc/sysctl.d/99-kubernetes-cri.conf`
      )}
      `;
  }

  private async _makeMasterCanSchedule() {
    // return `kubectl taint node ${hostName} node-role.kubernetes.io/master:NoSchedule-;`;
    const { mainMaster, masterArr } = this.env.getNodesSortedByRole();
    const masterNodeArr = [...masterArr, mainMaster];
    let script = '';
    masterNodeArr.map(masterNode => {
      script += `
      kubectl taint node ${masterNode.hostName} node-role.kubernetes.io/master:NoSchedule-;
      `;
    });

    mainMaster.cmd = script;
    await mainMaster.exeCmd();
  }

  private async _getWorkerJoinCmd(mainMaster: Node) {
    mainMaster.cmd = AbstractScript.getK8sClusterWorkerJoinScript();
    let workerJoinCmd = '';
    await ssh.send(mainMaster, {
      close: () => {},
      stdout: (data: string) => {
        workerJoinCmd = data.toString().split('@@@')[1];
      },
      stderr: () => {}
    });

    return workerJoinCmd;
  }

  private async _getMasterJoinCmd(mainMaster: Node) {
    const script = ScriptFactory.createScript(mainMaster.os.type);
    mainMaster.cmd = AbstractScript.getK8sClusterMasterJoinScript();
    let masterJoinCmd = '';
    await ssh.send(mainMaster, {
      close: () => {},
      stdout: (data: string) => {
        masterJoinCmd = data.toString().split('%%%')[1];
      },
      stderr: () => {}
    });

    return masterJoinCmd;
  }

  private async _envSetting(param: { registry?: string; callback: any }) {
    console.debug('@@@@@@ Start env setting... @@@@@@');
    const { registry, callback } = param;
    await this._setNtp(callback);
    if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
      // internal network 경우 해주어야 할 작업들
      /**
       * 1. 패키지 파일 다운(client 로컬), 전송(각 노드), 설치 (각 노드) (현재 Kubernetes 설치 시에만 진행)
       */
      await this._downloadPackageFile();
      await this._sendPackageFile();
      await this._installLocalPackageRepository(callback);
    } else if (this.env.networkType === NETWORK_TYPE.EXTERNAL) {
      // external network 경우 해주어야 할 작업들
    }

    if (registry) {
      // 내부 image registry 구축 경우 해주어야 할 작업들
      /**
       * 1. image registry 설치 (main 마스터 노드)
       */
      await this._installImageRegistry(registry, callback);
    }
    console.debug('###### Finish env setting... ######');
  }

  private async _setNtp(callback: any) {
    console.debug('@@@@@@ Start setting ntp... @@@@@@');
    const {
      mainMaster,
      masterArr,
      workerArr
    } = this.env.getNodesSortedByRole();

    // 기존 서버 목록 주석 처리
    if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
      // main master를 ntp 서버로
      // main master를 제외한 노드를 ntp client로 설정하기 위함
      let script = ScriptFactory.createScript(mainMaster.os.type);
      mainMaster.cmd = script.installNtp();
      mainMaster.cmd += AbstractScript.setNtpServer();
      await mainMaster.exeCmd(callback);
      workerArr.concat(masterArr);
      await Promise.all(
        workerArr.map(worker => {
          script = ScriptFactory.createScript(worker.os.type);
          worker.cmd = script.installNtp();
          worker.cmd += AbstractScript.setNtpClient(mainMaster.ip);
          return worker.exeCmd(callback);
        })
      );
    } else if (this.env.networkType === NETWORK_TYPE.EXTERNAL) {
      // 한국 공용 타임서버 목록 설정
      await Promise.all(
        this.env.nodeList.map((node: Node) => {
          const script = ScriptFactory.createScript(node.os.type);
          node.cmd = script.installNtp();
          node.cmd += AbstractScript.setPublicNtp();
          return node.exeCmd(callback);
        })
      );
    }
    console.debug('###### Finish setting ntp... ######');
  }
}
