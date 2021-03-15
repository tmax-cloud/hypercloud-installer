/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
import AbstractInstaller from './AbstractInstaller';
import Env, { NETWORK_TYPE } from '../Env';
import * as scp from '../../common/scp';
import Node, { ROLE } from '../Node';
import * as ssh from '../../common/ssh';
import * as git from '../../common/git';
import CONST from '../../constants/constant';
import ScriptFactory from '../script/ScriptFactory';
import * as common from '../../common/common';
import AbstractScript from '../script/AbstractScript';

export default class KubernetesInstaller extends AbstractInstaller {
  public static readonly DIR = `install-k8s`;

  public static readonly ARCHIVE_DIR = `archive_20.07.10`;

  public static readonly INSTALL_HOME = `${Env.INSTALL_ROOT}/${KubernetesInstaller.DIR}`;

  public static readonly IMAGE_REGISTRY_INSTALL_HOME = `${Env.INSTALL_ROOT}/hypercloud-install-guide/Image_Registry/installer`;

  public static readonly IMAGE_HOME = `${KubernetesInstaller.INSTALL_HOME}/image`;

  public static readonly ARCHIVE_HOME = `${Env.INSTALL_ROOT}/${KubernetesInstaller.ARCHIVE_DIR}`;

  public static readonly K8S_VERSION = `1.19.4`;

  public static readonly CRIO_VERSION = `1.19:1.19.1`;

  // public static readonly K8S_VERSION = `1.17.8`;

  // public static readonly CRIO_VERSION = `1.17`;

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
    /**
     * k8s설치는 prolinux지원, 호스트네임 등록, keepalived 설정 등
     * 여러 신경써야할 부분들이 있어서
     * 담당자가 제공해주는 스크립트로는 설치하기가 애매함...
     * 따라서 코드상에서 스크립트를 하드코딩으로 넣는 방식으로 구현해놓음
     */

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
    const {
      workerArr,
      masterArr,
      mainMaster
    } = this.env.getNodesSortedByRole();
    await this._getRemoveScript(workerArr, 'Worker');
    await this._getRemoveScript(masterArr, 'Master');
    await this._getRemoveScript([mainMaster], 'MainMaster');

    // await this._removeWorker();
    // await this._removeMaster();
    // await this._removeMainMaster();
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

      await this.downloadGitFile();
      await this.sendGitFile();
    } else if (this.env.networkType === NETWORK_TYPE.EXTERNAL) {
      // external network 경우 해주어야 할 작업들
      /**
       * 1. public 패키지 레포 등록, 설치 (각 노드) (필요 시)
       * 2. git guide clone (각 노드)
       */
      await this._setPublicPackageRepository(callback);
      await this._installPackage(callback);

      await this.cloneGitFile(callback);
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
    const srcPath = `${Env.LOCAL_INSTALL_ROOT}/${KubernetesInstaller.DIR}/`;
    await scp.sendFile(
      mainMaster,
      srcPath,
      `${KubernetesInstaller.IMAGE_HOME}/`
    );
    console.debug(
      '###### Finish sending the image file to main master node... ######'
    );
  }

  protected async downloadGitFile() {
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

  protected async sendGitFile() {
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

  protected async cloneGitFile(callback: any) {
    console.debug('@@@@@@ Start clone the GIT file at each node... @@@@@@');
    await Promise.all(
      this.env.nodeList.map((node: Node) => {
        const script = ScriptFactory.createScript(node.os.type);
        node.cmd = script.cloneGitFile(CONST.K8S_REPO, CONST.GIT_BRANCH);

        // FIXME: 현재 이전 git도 임시로 받음(repo 나누어지지 않은 모듈 설치 위해)
        node.cmd += script.cloneGitFile(
          `https://github.com/tmax-cloud/hypercloud-install-guide.git`,
          CONST.GIT_BRANCH
        );
        return node.exeCmd(callback);
      })
    );
    console.debug('###### Finish clone the GIT file at each node... ######');
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
  public async addWorker(registry: string, version: string, callback?: any) {
    await this._envSetting({ callback });
    await this.preWorkInstall({ callback });
    await this._installWorker(registry, version, callback);
  }

  public async addMaster(registry: string, version: string, callback?: any) {
    await this._envSetting({ callback });
    await this.preWorkInstall({ callback });
    await this._installMaster(registry, version, callback);
    await this._makeMasterCanSchedule();
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
    const script = ScriptFactory.createScript(mainMaster.os.type);
    mainMaster.cmd = `
      ${script.getMasterMultiplexingScript(
        mainMaster,
        99999999,
        this.env.virtualIp
      )}
      ${AbstractScript.setK8sConfig(
        registry,
        version,
        this.env.virtualIp,
        mainMaster.ip,
        podSubnet
      )}
      ${script.setEnvForKubernetes(mainMaster.hostName)}
      ${script.startInstallCrio()}
      ${script.startInstallKubernetes()}
      ${AbstractScript.initKube()}
      ${AbstractScript.makeMasterKubeConfig()}
      ${common.getDeleteDuplicationCommandByFilePath(
        `/etc/sysctl.d/99-kubernetes-cri.conf`
      )}`;
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
        const script = ScriptFactory.createScript(master.os.type);
        master.cmd = `
        ${script.getMasterMultiplexingScript(
          master,
          Math.floor(Math.random() * 99999999),
          this.env.virtualIp
        )}
        ${AbstractScript.setK8sConfig(
          registry,
          version,
          this.env.virtualIp,
          mainMaster.ip
        )}
        ${script.setEnvForKubernetes(master.hostName)}
        ${script.startInstallCrio()}
        ${script.startInstallKubernetes()}
        ${masterJoinCmd.trim()} --cri-socket=/var/run/crio/crio.sock;
        ${AbstractScript.makeMasterKubeConfig()}
        ${common.getDeleteDuplicationCommandByFilePath(
          `/etc/sysctl.d/99-kubernetes-cri.conf`
        )}
        `;
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
        const script = ScriptFactory.createScript(worker.os.type);
        worker.cmd = `
        ${AbstractScript.setK8sConfig(
          registry,
          version,
          this.env.virtualIp,
          mainMaster.ip
        )}
        ${script.setEnvForKubernetes(worker.hostName)}
        ${script.startInstallCrio()}
        ${script.startInstallKubernetes()}
        ${workerJoinCmd.trim()} --cri-socket=/var/run/crio/crio.sock;
        ${common.getDeleteDuplicationCommandByFilePath(
          `/etc/sysctl.d/99-kubernetes-cri.conf`
        )}
        `;
        return worker.exeCmd(callback);
      })
    );
    console.debug('###### Finish installing Worker... ######');
  }

  private async _getRemoveScript(nodeArr: any[], type: string) {
    console.debug(`@@@@@@ Start remove ${type}... @@@@@@`);
    await Promise.all(
      nodeArr.map((node: Node) => {
        const script = ScriptFactory.createScript(node.os.type);
        node.cmd = script.getK8sMasterRemoveScript();
        return node.exeCmd();
      })
    );
    console.debug(`###### Finish remove ${type}... ######`);
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

  private async _makeMasterCanSchedule() {
    const { mainMaster, masterArr } = this.env.getNodesSortedByRole();
    const masterNodeArr = [...masterArr, mainMaster];
    let script = '';
    masterNodeArr.forEach(masterNode => {
      script += AbstractScript.removeTaintNoScheduleByHostName(
        masterNode.hostName
      );
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
    await this._setLvm2(callback);
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

  private async _setLvm2(callback: any) {
    await Promise.all(
      this.env.nodeList.map((node: Node) => {
        const script = ScriptFactory.createScript(node.os.type);
        node.cmd = script.installLvm2();
        return node.exeCmd(callback);
      })
    );
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
